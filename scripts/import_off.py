"""
Imports common Israeli/Hebrew food products from Open Food Facts
and merges them into hebrew_ingredients.json.

Usage:
    python scripts/import_off.py
"""

import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "backend" / "app" / "data" / "hebrew_ingredients.json"

OFF_API = "https://world.openfoodfacts.org/cgi/search.pl"

SEARCH_TERMS = [
    # Proteins
    "חזה עוף", "שניצל עוף", "טחון עוף", "קציצות עוף",
    "טחון בקר", "סטייק בקר", "שישליק",
    "טחון הודו", "פרגית",
    "סלמון", "דג מוסר", "דג לברק", "פילה דג",
    "ביצה", "חלבון ביצה",
    "טונה", "סרדינים",
    # Dairy & protein
    "קוטג", "גבינה לבנה", "לאבנה", "ריקוטה",
    "יוגורט יווני", "פרוביוטי",
    "חלב 1%", "חלב 3%",
    "גבינה צהובה", "גבינה בולגרית", "פטה",
    # Grains & carbs
    "אורז בסמטי", "אורז מלא", "פסטה מלאה",
    "לחם מלא", "לחם שיפון", "פיתה", "לחמנייה",
    "כוסמת", "קינואה", "שיבולת שועל",
    "תירס מתוק", "אפונה", "עדשים",
    # Vegetables
    "ברוקולי", "כרובית", "תרד", "מנגולד",
    "פלפל אדום", "פלפל ירוק", "חציל", "קישוא",
    "בטטה", "שעועית ירוקה", "אספרגוס",
    "כרוב", "גמבה",
    # Fruits
    "עגבנייה", "מלון", "אבטיח", "תות שדה",
    "ענבים", "אפרסמון", "מנגו", "פפאיה",
    "תמר", "אגס", "שזיף",
    # Fats & sauces
    "טחינה", "חומוס מוכן", "גואקמולי",
    "שמן קוקוס", "חמאת בוטנים", "ממרח שקדים",
    # Snacks & packaged
    "גרנולה", "חטיף חלבון", "בר חלבון",
    "שוקו", "קקאו", "שוקולד מריר 85%",
    "קרקר", "מצה", "ביסלי", "במבה",
    # Drinks
    "מיץ תפוזים", "מיץ עגבניות",
    "חלב שקדים", "חלב שיבולת שועל", "חלב סויה",
]

COUNTRY_CODES = ["il", "world"]

HEADERS = {
    "User-Agent": "CalorieCalculatorIL/1.0 (https://github.com/uriel123bm/Calorie_Calculato)"
}


def fetch_off(term: str, country: str = "il") -> list[dict]:
    params = urllib.parse.urlencode({
        "search_terms": term,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 5,
        "lc": "he",
    })
    url = f"https://{country}.openfoodfacts.org/cgi/search.pl?{params}"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read())
        return data.get("products", [])
    except Exception as e:
        print(f"  ⚠  fetch error for '{term}': {e}")
        return []


def extract_nutrition(product: dict) -> dict | None:
    n = product.get("nutriments", {})

    def get(key: str) -> float:
        for suffix in ("_100g", ""):
            v = n.get(f"{key}{suffix}")
            if v is not None:
                try:
                    return round(float(v), 2)
                except (ValueError, TypeError):
                    pass
        return None

    calories = get("energy-kcal")
    if calories is None:
        # fallback: kJ → kcal
        kj = get("energy-kj") or get("energy")
        if kj is not None:
            calories = round(kj / 4.184, 1)
    if calories is None:
        return None

    return {
        "calories": calories,
        "protein": get("proteins") or 0.0,
        "carbohydrates": get("carbohydrates") or 0.0,
        "sugar": get("sugars") or 0.0,
        "fat": get("fat") or 0.0,
        "sodium": round((get("sodium") or 0.0) * 1000, 1),  # g → mg
    }


def best_name(product: dict, search_term: str) -> str:
    for lang in ("he", ""):
        name = product.get(f"product_name_{lang}") or product.get("product_name")
        if name and len(name) > 1:
            return name.strip()
    return search_term


def load_db() -> tuple[dict, set[str]]:
    with open(DATA_PATH, encoding="utf-8") as f:
        db = json.load(f)
    existing = {item["name"].strip().lower() for item in db["ingredients"]}
    for item in db["ingredients"]:
        for alias in item.get("aliases", []):
            existing.add(alias.strip().lower())
    return db, existing


def save_db(db: dict):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def main():
    db, existing = load_db()
    added = 0
    skipped = 0

    for term in SEARCH_TERMS:
        print(f"🔍 Searching: {term}")
        products = fetch_off(term, "il")
        if not products:
            products = fetch_off(term, "world")

        for product in products:
            nutrition = extract_nutrition(product)
            if nutrition is None:
                continue

            # Must have some protein or calories to be useful
            if nutrition["calories"] <= 0:
                continue

            name = best_name(product, term)
            name_lower = name.strip().lower()

            if name_lower in existing:
                skipped += 1
                continue

            # Accept only Hebrew-character names (or the original search term)
            has_hebrew = any("\u05d0" <= c <= "\u05ea" for c in name)
            if not has_hebrew:
                name = term  # use the Hebrew search term as fallback
                name_lower = name.strip().lower()
                if name_lower in existing:
                    skipped += 1
                    continue

            entry = {
                "name": name,
                "aliases": [term] if term.strip().lower() != name_lower else [],
                "nutrition_per_100g": nutrition,
                "_source": "openfoodfacts",
            }
            db["ingredients"].append(entry)
            existing.add(name_lower)
            if term.strip().lower() != name_lower:
                existing.add(term.strip().lower())
            added += 1
            print(f"  ✅ Added: {name} | {round(nutrition['calories'])} cal, {nutrition['protein']}g prot")
            break  # take best match only

        time.sleep(0.4)  # be polite to the API

    # Remove _source metadata before saving (it's just for our reference)
    for item in db["ingredients"]:
        item.pop("_source", None)

    save_db(db)
    print(f"\n✅ Done! Added {added} new products, skipped {skipped} existing.")
    print(f"📦 Total in database: {len(db['ingredients'])}")


if __name__ == "__main__":
    main()
