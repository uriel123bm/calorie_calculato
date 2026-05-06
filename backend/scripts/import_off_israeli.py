"""
Import Israeli products from Open Food Facts into hebrew_ingredients.json.

Rules:
- Local entries ALWAYS win — existing names/aliases are never overwritten.
- Only products with calories + at least 2 other macros are imported.
- Only Hebrew-named products (contain Hebrew characters) are imported.
- Duplicates are detected by normalizing names (lowercase, strip punctuation).
- Run: python scripts/import_off_israeli.py [--dry-run] [--pages N]
"""
from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path

import httpx

DATA_FILE = Path(__file__).parent.parent / "app" / "data" / "hebrew_ingredients.json"
OFF_URL = "https://il.openfoodfacts.org/cgi/search.pl"
HEADERS = {"User-Agent": "CalorieCalculatorIL/1.0 (educational; contact via github)"}

_PUNCT = re.compile(r"[\s\u00A0\-_\.,/\\!?\"'״׳`׃]+")
_HAS_HEBREW = re.compile(r"[\u0590-\u05FF]")


def normalize(name: str) -> str:
    s = unicodedata.normalize("NFKC", name).lower().strip()
    return _PUNCT.sub(" ", s).strip()


def safe_float(v: object) -> float:
    try:
        return max(0.0, float(v)) if v not in (None, "") else 0.0
    except (TypeError, ValueError):
        return 0.0


def load_db() -> dict:
    with DATA_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_db(db: dict) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def build_existing_names(ingredients: list[dict]) -> set[str]:
    """Collect all normalized names + aliases already in the DB."""
    names: set[str] = set()
    for item in ingredients:
        names.add(normalize(item["name"]))
        for alias in item.get("aliases", []):
            names.add(normalize(alias))
    return names


def fetch_page(page: int, page_size: int = 100, retries: int = 3) -> list[dict]:
    params = {
        "tagtype_0": "countries",
        "tag_contains_0": "contains",
        "tag_0": "israel",
        "action": "process",
        "json": 1,
        "page": page,
        "page_size": page_size,
        "fields": "product_name,product_name_he,nutriments,quantity",
        "sort_by": "unique_scans_n",
    }
    urls = [OFF_URL, OFF_URL.replace("il.openfoodfacts", "world.openfoodfacts")]
    for attempt in range(retries):
        url = urls[attempt % len(urls)]
        try:
            resp = httpx.get(url, params=params, headers=HEADERS, timeout=25.0)
            resp.raise_for_status()
            return resp.json().get("products", [])
        except Exception as exc:
            wait = 5 * (attempt + 1)
            print(f"  [!] Page {page} attempt {attempt+1} error: {exc}. Retrying in {wait}s…")
            time.sleep(wait)
    return []


def product_to_entry(product: dict) -> dict | None:
    # Prefer Hebrew name
    name_he = (product.get("product_name_he") or "").strip()
    name_en = (product.get("product_name") or "").strip()

    # Must have a Hebrew name
    if not name_he or not _HAS_HEBREW.search(name_he):
        return None

    n = product.get("nutriments") or {}

    # Calories
    calories = safe_float(n.get("energy-kcal_100g"))
    if calories == 0:
        kj = n.get("energy_100g") or n.get("energy-kj_100g")
        calories = safe_float(kj) / 4.184 if kj else 0

    protein = safe_float(n.get("proteins_100g"))
    carbs = safe_float(n.get("carbohydrates_100g"))
    sugar = safe_float(n.get("sugars_100g"))
    fat = safe_float(n.get("fat_100g"))
    sodium_g = safe_float(n.get("sodium_100g"))
    if sodium_g == 0:
        sodium_g = safe_float(n.get("salt_100g")) / 2.5
    sodium_mg = round(sodium_g * 1000, 1)

    # Quality gate: must have calories + at least 2 macros + sanity check
    macros_present = sum(1 for v in [protein, carbs, fat] if v > 0)
    if calories == 0 or macros_present < 2:
        return None
    # Sanity: max 900 kcal/100g (pure fat ceiling), min sane macro sum
    if calories > 900:
        return None
    macro_sum = protein * 4 + carbs * 4 + fat * 9
    if macro_sum > 0 and abs(calories - macro_sum) / max(calories, macro_sum) > 0.6:
        return None  # macros and calories wildly inconsistent

    entry: dict = {
        "name": name_he,
        "aliases": [name_en] if name_en and name_en != name_he else [],
        "nutrition_per_100g": {
            "calories": round(calories, 1),
            "protein": round(protein, 1),
            "carbohydrates": round(carbs, 1),
            "sugar": round(sugar, 1),
            "fat": round(fat, 1),
            "sodium": round(sodium_mg, 1),
        },
    }
    return entry


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Israeli OFF products")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--pages", type=int, default=10, help="How many OFF pages to fetch (100 products each)")
    args = parser.parse_args()

    print(f"Loading existing DB from {DATA_FILE}")
    db = load_db()
    existing = build_existing_names(db["ingredients"])
    print(f"  {len(db['ingredients'])} existing entries, {len(existing)} normalized names")

    added: list[dict] = []
    skipped_conflict = 0
    skipped_quality = 0
    skipped_no_hebrew = 0

    for page in range(1, args.pages + 1):
        print(f"Fetching page {page}/{args.pages}…")
        products = fetch_page(page)
        if not products:
            print("  No products returned — stopping.")
            break

        for product in products:
            entry = product_to_entry(product)
            if entry is None:
                # Distinguish reason
                name_he = (product.get("product_name_he") or "").strip()
                if not name_he or not _HAS_HEBREW.search(name_he):
                    skipped_no_hebrew += 1
                else:
                    skipped_quality += 1
                continue

            norm = normalize(entry["name"])
            if norm in existing:
                skipped_conflict += 1
                continue

            # Also check aliases
            alias_conflict = any(normalize(a) in existing for a in entry["aliases"])
            if alias_conflict:
                skipped_conflict += 1
                continue

            # New entry — add it
            existing.add(norm)
            for a in entry["aliases"]:
                existing.add(normalize(a))
            added.append(entry)
            print(f"  + {entry['name']} ({entry['nutrition_per_100g']['calories']} kcal)")

        time.sleep(0.5)  # be polite to OFF API

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Results:")
    print(f"  Added:              {len(added)}")
    print(f"  Skipped (conflict): {skipped_conflict}")
    print(f"  Skipped (quality):  {skipped_quality}")
    print(f"  Skipped (no Hebrew):{skipped_no_hebrew}")

    if not args.dry_run and added:
        db["ingredients"].extend(added)
        save_db(db)
        print(f"\nSaved. DB now has {len(db['ingredients'])} entries.")
    elif args.dry_run:
        print("\nDry run — nothing saved.")
    else:
        print("\nNothing new to add.")


if __name__ == "__main__":
    main()
