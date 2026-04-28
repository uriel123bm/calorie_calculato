"""Multi-tier nutrition lookup.

Resolution order:
    1. Local hand-curated Hebrew JSON dataset (high confidence).
    2. Open Food Facts public search API (medium confidence).
    3. Returns ``None`` so the caller can invoke the AI fallback.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import httpx

from app.core.config import settings
from app.models.ingredient import NutritionPer100g, NutritionSource


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------


@dataclass
class LookupResult:
    nutrition: NutritionPer100g
    confidence: float
    source: NutritionSource
    matched_name: str
    unit_weight_g: Optional[float] = None


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------


_PUNCT_RE = re.compile(r"[\s\u00A0\-_\.,/\\!?\"'״׳`׃]+")


def _normalize(name: str) -> str:
    """Normalize a Hebrew/English ingredient name for matching."""
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFKC", name).lower().strip()
    decomposed = _PUNCT_RE.sub(" ", decomposed)
    decomposed = decomposed.replace("\u05BE", " ")
    return decomposed.strip()


# ---------------------------------------------------------------------------
# Local dataset
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def _load_local_dataset() -> list[dict]:
    path = settings.data_dir / "hebrew_ingredients.json"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    return payload.get("ingredients", [])


def _substring_rank_key(
    needle: str, nc: str, dataset_index: int
) -> Optional[tuple[int, int | float, int]]:
    """Ranking key for non-exact containment (higher tuple compares greater)."""
    if not nc or nc == needle:
        return None
    # User typed a longer phrase that contains this catalog substring — prefer longest match.
    if nc in needle:
        return (3, len(nc), -dataset_index)
    # User typed shorthand contained in catalog name — prefer shorter ingredient name (dry vs cooked rows).
    if needle in nc:
        return (2, -len(nc), -dataset_index)
    return None


def _local_lookup(name: str) -> Optional[LookupResult]:
    needle = _normalize(name)
    if not needle:
        return None

    dataset = _load_local_dataset()

    for entry in dataset:
        for cand in [entry["name"], *entry.get("aliases", [])]:
            nc = _normalize(str(cand) if cand else "")
            if nc and nc == needle:
                return LookupResult(
                    nutrition=NutritionPer100g(**entry["nutrition_per_100g"]),
                    confidence=0.95,
                    source="local",
                    matched_name=str(cand).strip() if cand else entry["name"],
                    unit_weight_g=entry.get("unit_weight_g"),
                )

    best_rank: tuple[int, int | float, int] | None = None
    chosen_entry: dict | None = None
    matched_label: str | None = None

    for i, entry in enumerate(dataset):
        for cand in [entry["name"], *entry.get("aliases", [])]:
            nc = _normalize(str(cand) if cand else "")
            if not nc or nc == needle:
                continue
            if not (nc in needle or needle in nc):
                continue
            rk = _substring_rank_key(needle, nc, i)
            if rk is None:
                continue
            if best_rank is None or rk > best_rank:
                best_rank = rk
                chosen_entry = entry
                matched_label = str(cand).strip() if cand else entry["name"]

    if chosen_entry is None or matched_label is None:
        return None

    tier = (best_rank or (0,))[0]
    confidence = 0.85 if tier >= 3 else 0.83

    return LookupResult(
        nutrition=NutritionPer100g(**chosen_entry["nutrition_per_100g"]),
        confidence=confidence,
        source="local",
        matched_name=matched_label or chosen_entry["name"],
        unit_weight_g=chosen_entry.get("unit_weight_g"),
    )


# ---------------------------------------------------------------------------
# Open Food Facts
# ---------------------------------------------------------------------------


_OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
_HAS_HEBREW = re.compile(r"[\u0590-\u05FF]")


def _off_match_score(user_query: str, product: dict) -> float:
    """Heuristic 0..1: how well the product titles match the user's search terms."""
    nq = _normalize(user_query)
    if not nq:
        return 0.0
    best = 0.0
    he = (product.get("product_name_he") or "").strip()
    en = (product.get("product_name") or "").strip()
    # Prefer Hebrew display name when present and actually Hebrew.
    weighted: list[tuple[str, float]] = []
    if he and _HAS_HEBREW.search(he):
        weighted.append((he, 1.1))
    elif he:
        weighted.append((he, 1.02))
    if en:
        weighted.append((en, 1.0))
    for title, w in weighted:
        nt = _normalize(title)
        if not nt:
            continue
        s: float
        if nq == nt:
            s = 1.0
        elif nq in nt or nt in nq:
            s = 0.82 + 0.08 * min(len(nq), len(nt)) / max(len(nq), len(nt), 1)
        else:
            tq, tt = set(nq.split()), set(nt.split())
            inter = len(tq & tt)
            s = 0.42 * (inter / max(len(tq), 1)) if inter else 0.0
        best = max(best, min(1.0, s * w))
    return min(1.0, best)


def _confidence_from_off_score(score: float) -> float:
    """Map heuristic match strength to numeric confidence (~0.55 weak .. ~0.72 strong)."""
    return round(min(0.72, max(0.55, 0.55 + score * 0.17)), 3)


def _safe_float(value: object) -> float:
    try:
        if value is None or value == "":
            return 0.0
        return max(float(value), 0.0)
    except (TypeError, ValueError):
        return 0.0


def _map_off_product(product: dict) -> Optional[NutritionPer100g]:
    nutriments = product.get("nutriments") or {}

    calories = nutriments.get("energy-kcal_100g")
    if calories in (None, "", 0):
        kj = nutriments.get("energy_100g") or nutriments.get("energy-kj_100g")
        calories = (_safe_float(kj) / 4.184) if kj else 0

    if not (calories or nutriments.get("proteins_100g") or nutriments.get("carbohydrates_100g")
            or nutriments.get("fat_100g")):
        return None

    sodium_g = nutriments.get("sodium_100g")
    if sodium_g in (None, ""):
        salt_g = _safe_float(nutriments.get("salt_100g"))
        sodium_g = salt_g / 2.5 if salt_g else 0

    return NutritionPer100g(
        calories=_safe_float(calories),
        protein=_safe_float(nutriments.get("proteins_100g")),
        carbohydrates=_safe_float(nutriments.get("carbohydrates_100g")),
        sugar=_safe_float(nutriments.get("sugars_100g")),
        fat=_safe_float(nutriments.get("fat_100g")),
        sodium=_safe_float(sodium_g) * 1000,
    )


async def _openfoodfacts_lookup(name: str) -> Optional[LookupResult]:
    params = {
        "search_terms": name,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 24,
        "fields": "product_name,product_name_he,brands,nutriments",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                _OFF_SEARCH_URL,
                params=params,
                headers={"User-Agent": "RecipeCalorieCalculator/0.1 (educational)"},
            )
        if resp.status_code != 200:
            return None
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None

    ranked: list[tuple[float, NutritionPer100g, str]] = []
    for product in data.get("products", []):
        nutrition = _map_off_product(product)
        if nutrition is None:
            continue
        sc = _off_match_score(name, product)
        matched = (
            product.get("product_name_he")
            or product.get("product_name")
            or name
        )
        ranked.append((sc, nutrition, str(matched)))

    if not ranked:
        return None

    ranked.sort(key=lambda t: t[0], reverse=True)
    best_score, nutrition, matched = ranked[0]
    confidence = _confidence_from_off_score(best_score)
    return LookupResult(
        nutrition=nutrition,
        confidence=confidence,
        source="openfoodfacts",
        matched_name=matched,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def lookup(name: str) -> Optional[LookupResult]:
    """Resolve nutrition for ``name`` using the local then OFF tiers.

    Returns ``None`` if neither tier produced a hit; callers should then fall
    back to the AI estimator.
    """
    local = _local_lookup(name)
    if local is not None:
        return local

    return await _openfoodfacts_lookup(name)
