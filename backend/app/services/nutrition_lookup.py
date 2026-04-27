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


def _local_lookup(name: str) -> Optional[LookupResult]:
    needle = _normalize(name)
    if not needle:
        return None

    dataset = _load_local_dataset()

    exact_match: Optional[dict] = None
    substring_match: Optional[dict] = None
    matched_alias: Optional[str] = None

    for entry in dataset:
        candidates = [entry["name"], *entry.get("aliases", [])]
        for cand in candidates:
            normalized = _normalize(cand)
            if normalized == needle:
                exact_match = entry
                matched_alias = cand
                break
            if substring_match is None and normalized and (
                needle in normalized or normalized in needle
            ):
                substring_match = entry
                matched_alias = cand
        if exact_match:
            break

    chosen = exact_match or substring_match
    if chosen is None:
        return None

    return LookupResult(
        nutrition=NutritionPer100g(**chosen["nutrition_per_100g"]),
        confidence=0.95 if exact_match else 0.85,
        source="local",
        matched_name=matched_alias or chosen["name"],
        unit_weight_g=chosen.get("unit_weight_g"),
    )


# ---------------------------------------------------------------------------
# Open Food Facts
# ---------------------------------------------------------------------------


_OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"


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
        "page_size": 5,
        "fields": "product_name,product_name_he,brands,nutriments",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
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

    for product in data.get("products", []):
        nutrition = _map_off_product(product)
        if nutrition is None:
            continue
        matched = (
            product.get("product_name_he")
            or product.get("product_name")
            or name
        )
        return LookupResult(
            nutrition=nutrition,
            confidence=0.7,
            source="openfoodfacts",
            matched_name=str(matched),
        )

    return None


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
