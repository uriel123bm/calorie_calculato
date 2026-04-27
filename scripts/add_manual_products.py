"""Adds a large batch of common Israeli food products to hebrew_ingredients.json."""
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "backend" / "app" / "data" / "hebrew_ingredients.json"

NEW_PRODUCTS = [
    # ===== בשר ועוף =====
    {"name": "פרגית", "aliases": ["ירך עוף ללא עצם", "ירך עוף"],
     "nutrition_per_100g": {"calories": 177, "protein": 18, "carbohydrates": 0, "sugar": 0, "fat": 11, "sodium": 80}},
    {"name": "שניצל עוף", "aliases": ["שניצל", "שניצל עוף מטוגן"],
     "nutrition_per_100g": {"calories": 218, "protein": 17, "carbohydrates": 12, "sugar": 0.5, "fat": 11, "sodium": 420}},
    {"name": "בשר טחון עוף", "aliases": ["טחון עוף", "עוף טחון"],
     "nutrition_per_100g": {"calories": 143, "protein": 17, "carbohydrates": 0, "sugar": 0, "fat": 8, "sodium": 70}},
    {"name": "הודו טחון", "aliases": ["טחון הודו", "בשר הודו טחון"],
     "nutrition_per_100g": {"calories": 155, "protein": 20, "carbohydrates": 0, "sugar": 0, "fat": 8, "sodium": 65}},
    {"name": "חזה הודו", "aliases": ["הודו", "פרוסות הודו"],
     "nutrition_per_100g": {"calories": 135, "protein": 30, "carbohydrates": 0, "sugar": 0, "fat": 1, "sodium": 57}},
    {"name": "בשר בקר טחון", "aliases": ["טחון בקר", "קציצות בקר"],
     "nutrition_per_100g": {"calories": 254, "protein": 26, "carbohydrates": 0, "sugar": 0, "fat": 17, "sodium": 72}},
    {"name": "כבד עוף", "aliases": ["כבד"],
     "nutrition_per_100g": {"calories": 167, "protein": 24, "carbohydrates": 0.9, "sugar": 0, "fat": 7, "sodium": 71}},
    # ===== דגים =====
    {"name": "דג לברק", "aliases": ["לברק"],
     "nutrition_per_100g": {"calories": 124, "protein": 23, "carbohydrates": 0, "sugar": 0, "fat": 3.5, "sodium": 60},
     "unit_weight_g": 300},
    {"name": "דג מוסר", "aliases": ["מוסר ים"],
     "nutrition_per_100g": {"calories": 130, "protein": 24, "carbohydrates": 0, "sugar": 0, "fat": 3.8, "sodium": 65},
     "unit_weight_g": 250},
    {"name": "פילה בקלה", "aliases": ["בקלה", "קוד"],
     "nutrition_per_100g": {"calories": 82, "protein": 18, "carbohydrates": 0, "sugar": 0, "fat": 0.7, "sodium": 54}},
    {"name": "סרדינים", "aliases": ["סרדין"],
     "nutrition_per_100g": {"calories": 208, "protein": 25, "carbohydrates": 0, "sugar": 0, "fat": 11, "sodium": 307}},
    {"name": "חלבון ביצה", "aliases": ["לבן ביצה", "חלבוני ביצה"],
     "nutrition_per_100g": {"calories": 52, "protein": 11, "carbohydrates": 0.7, "sugar": 0.7, "fat": 0.2, "sodium": 166}},
    # ===== מוצרי חלב =====
    {"name": "יוגורט יווני", "aliases": ["יוגורט 0%", "יוגורט לייט"],
     "nutrition_per_100g": {"calories": 59, "protein": 10, "carbohydrates": 3.6, "sugar": 3.6, "fat": 0.4, "sodium": 36}},
    {"name": "גבינה בולגרית", "aliases": ["גבינה בולגרית 5%"],
     "nutrition_per_100g": {"calories": 264, "protein": 14, "carbohydrates": 1, "sugar": 1, "fat": 23, "sodium": 800}},
    {"name": "גבינת פטה", "aliases": ["פטה", "גבינת פטה יוונית"],
     "nutrition_per_100g": {"calories": 264, "protein": 14, "carbohydrates": 1, "sugar": 1, "fat": 23, "sodium": 800}},
    {"name": "ריקוטה", "aliases": ["גבינת ריקוטה"],
     "nutrition_per_100g": {"calories": 174, "protein": 11, "carbohydrates": 3, "sugar": 0.3, "fat": 13, "sodium": 84}},
    {"name": "לאבנה", "aliases": ["גבינת לאבנה"],
     "nutrition_per_100g": {"calories": 180, "protein": 7, "carbohydrates": 5, "sugar": 5, "fat": 14, "sodium": 430}},
    {"name": "חלב 1%", "aliases": ["חלב דל שומן"],
     "nutrition_per_100g": {"calories": 42, "protein": 3.4, "carbohydrates": 5, "sugar": 5, "fat": 1, "sodium": 44}},
    {"name": "חלב 0%", "aliases": ["חלב רזה", "חלב גמלים"],
     "nutrition_per_100g": {"calories": 33, "protein": 3.3, "carbohydrates": 4.8, "sugar": 4.8, "fat": 0.1, "sodium": 44}},
    {"name": "שמנת חמוצה", "aliases": ["שמנת"],
     "nutrition_per_100g": {"calories": 193, "protein": 2.4, "carbohydrates": 4, "sugar": 4, "fat": 19, "sodium": 41}},
    {"name": "גבינת מוצרלה", "aliases": ["מוצרלה"],
     "nutrition_per_100g": {"calories": 280, "protein": 22, "carbohydrates": 2.2, "sugar": 1, "fat": 20, "sodium": 430}},
    {"name": "חלב שקדים", "aliases": ["חלב שקדים לא ממותק"],
     "nutrition_per_100g": {"calories": 15, "protein": 0.6, "carbohydrates": 0.6, "sugar": 0.1, "fat": 1.1, "sodium": 65}},
    {"name": "חלב סויה", "aliases": ["חלב סויה לא ממותק"],
     "nutrition_per_100g": {"calories": 33, "protein": 3.3, "carbohydrates": 1.8, "sugar": 1, "fat": 1.8, "sodium": 40}},
    {"name": "חלב שיבולת שועל", "aliases": ["אוט מילק"],
     "nutrition_per_100g": {"calories": 47, "protein": 1, "carbohydrates": 6.6, "sugar": 4, "fat": 1.5, "sodium": 60}},
    # ===== דגנים וקטניות =====
    {"name": "אורז בסמטי", "aliases": ["אורז בסמטי לבן"],
     "nutrition_per_100g": {"calories": 356, "protein": 7, "carbohydrates": 79, "sugar": 0, "fat": 0.6, "sodium": 5}},
    {"name": "אורז מלא", "aliases": ["אורז חום"],
     "nutrition_per_100g": {"calories": 370, "protein": 8, "carbohydrates": 77, "sugar": 0.7, "fat": 2.7, "sodium": 7}},
    {"name": "פסטה מלאה", "aliases": ["ספגטי מלא", "פסטה חיטה מלאה"],
     "nutrition_per_100g": {"calories": 348, "protein": 14, "carbohydrates": 68, "sugar": 3, "fat": 2, "sodium": 8}},
    {"name": "קינואה", "aliases": [],
     "nutrition_per_100g": {"calories": 368, "protein": 14, "carbohydrates": 64, "sugar": 0, "fat": 6, "sodium": 5}},
    {"name": "כוסמת", "aliases": ["כוסמת יבשה"],
     "nutrition_per_100g": {"calories": 343, "protein": 13, "carbohydrates": 71, "sugar": 0, "fat": 3.4, "sodium": 1}},
    {"name": "אורז מבושל", "aliases": ["אורז מוכן"],
     "nutrition_per_100g": {"calories": 130, "protein": 2.7, "carbohydrates": 28, "sugar": 0, "fat": 0.3, "sodium": 5}},
    {"name": "פסטה מבושלת", "aliases": ["פסטה מוכנה"],
     "nutrition_per_100g": {"calories": 158, "protein": 5.5, "carbohydrates": 31, "sugar": 0.6, "fat": 0.9, "sodium": 4}},
    {"name": "קינואה מבושלת", "aliases": [],
     "nutrition_per_100g": {"calories": 120, "protein": 4.4, "carbohydrates": 21, "sugar": 0.9, "fat": 1.9, "sodium": 7}},
    {"name": "פיתה", "aliases": ["לחם פיתה"],
     "nutrition_per_100g": {"calories": 275, "protein": 9, "carbohydrates": 56, "sugar": 0.5, "fat": 1.2, "sodium": 490},
     "unit_weight_g": 55},
    {"name": "לחם מחמצת", "aliases": ["לחם סאורדאו"],
     "nutrition_per_100g": {"calories": 236, "protein": 8, "carbohydrates": 46, "sugar": 1.2, "fat": 1.5, "sodium": 440}},
    {"name": "לחם שיפון", "aliases": [],
     "nutrition_per_100g": {"calories": 259, "protein": 9, "carbohydrates": 48, "sugar": 3.8, "fat": 3.3, "sodium": 560}},
    {"name": "שעועית שחורה", "aliases": ["שעועית שחורה מבושלת"],
     "nutrition_per_100g": {"calories": 132, "protein": 8.9, "carbohydrates": 24, "sugar": 0.3, "fat": 0.5, "sodium": 240}},
    {"name": "אפונה", "aliases": ["אפונה ירוקה"],
     "nutrition_per_100g": {"calories": 81, "protein": 5.4, "carbohydrates": 14, "sugar": 5.7, "fat": 0.4, "sodium": 5}},
    # ===== ירקות =====
    {"name": "ברוקולי", "aliases": [],
     "nutrition_per_100g": {"calories": 34, "protein": 2.8, "carbohydrates": 7, "sugar": 1.7, "fat": 0.4, "sodium": 33}},
    {"name": "כרובית", "aliases": [],
     "nutrition_per_100g": {"calories": 25, "protein": 2, "carbohydrates": 5, "sugar": 1.9, "fat": 0.3, "sodium": 30}},
    {"name": "תרד", "aliases": ["עלי תרד"],
     "nutrition_per_100g": {"calories": 23, "protein": 2.9, "carbohydrates": 3.6, "sugar": 0.4, "fat": 0.4, "sodium": 79}},
    {"name": "בטטה", "aliases": ["תפוח אדמה מתוק"],
     "nutrition_per_100g": {"calories": 86, "protein": 1.6, "carbohydrates": 20, "sugar": 4.2, "fat": 0.1, "sodium": 55},
     "unit_weight_g": 160},
    {"name": "שעועית ירוקה", "aliases": ["שעועית", "פול ירוק"],
     "nutrition_per_100g": {"calories": 31, "protein": 1.8, "carbohydrates": 7, "sugar": 3.3, "fat": 0.2, "sodium": 6}},
    {"name": "פלפל אדום", "aliases": ["פלפל"],
     "nutrition_per_100g": {"calories": 31, "protein": 1, "carbohydrates": 6, "sugar": 4.2, "fat": 0.3, "sodium": 4},
     "unit_weight_g": 150},
    {"name": "פלפל ירוק", "aliases": [],
     "nutrition_per_100g": {"calories": 20, "protein": 0.9, "carbohydrates": 4.6, "sugar": 2.4, "fat": 0.2, "sodium": 3},
     "unit_weight_g": 150},
    {"name": "חציל", "aliases": [],
     "nutrition_per_100g": {"calories": 25, "protein": 1, "carbohydrates": 6, "sugar": 3.5, "fat": 0.2, "sodium": 2},
     "unit_weight_g": 350},
    {"name": "קישוא", "aliases": ["זוקיני"],
     "nutrition_per_100g": {"calories": 17, "protein": 1.2, "carbohydrates": 3.1, "sugar": 2.5, "fat": 0.3, "sodium": 8},
     "unit_weight_g": 200},
    {"name": "אספרגוס", "aliases": [],
     "nutrition_per_100g": {"calories": 20, "protein": 2.2, "carbohydrates": 3.9, "sugar": 1.9, "fat": 0.1, "sodium": 2}},
    {"name": "כרוב", "aliases": ["כרוב לבן"],
     "nutrition_per_100g": {"calories": 25, "protein": 1.3, "carbohydrates": 5.8, "sugar": 3.2, "fat": 0.1, "sodium": 18}},
    {"name": "גמבה", "aliases": ["גמבה אדומה", "גמבה ירוקה"],
     "nutrition_per_100g": {"calories": 31, "protein": 1, "carbohydrates": 6, "sugar": 4.2, "fat": 0.3, "sodium": 4},
     "unit_weight_g": 150},
    {"name": "מנגולד", "aliases": ["עלי מנגולד"],
     "nutrition_per_100g": {"calories": 19, "protein": 1.8, "carbohydrates": 3.7, "sugar": 1, "fat": 0.2, "sodium": 213}},
    # ===== פירות =====
    {"name": "אבטיח", "aliases": [],
     "nutrition_per_100g": {"calories": 30, "protein": 0.6, "carbohydrates": 7.6, "sugar": 6.2, "fat": 0.2, "sodium": 1}},
    {"name": "מלון", "aliases": [],
     "nutrition_per_100g": {"calories": 34, "protein": 0.8, "carbohydrates": 8, "sugar": 7.9, "fat": 0.2, "sodium": 16}},
    {"name": "תות שדה", "aliases": ["תותים"],
     "nutrition_per_100g": {"calories": 32, "protein": 0.7, "carbohydrates": 7.7, "sugar": 4.9, "fat": 0.3, "sodium": 1}},
    {"name": "ענבים", "aliases": [],
     "nutrition_per_100g": {"calories": 69, "protein": 0.6, "carbohydrates": 18, "sugar": 15, "fat": 0.2, "sodium": 2}},
    {"name": "מנגו", "aliases": [],
     "nutrition_per_100g": {"calories": 60, "protein": 0.8, "carbohydrates": 15, "sugar": 14, "fat": 0.4, "sodium": 1},
     "unit_weight_g": 200},
    {"name": "תמר", "aliases": ["תמרים"],
     "nutrition_per_100g": {"calories": 277, "protein": 1.8, "carbohydrates": 75, "sugar": 63, "fat": 0.2, "sodium": 1},
     "unit_weight_g": 8},
    {"name": "אפרסמון", "aliases": [],
     "nutrition_per_100g": {"calories": 70, "protein": 0.6, "carbohydrates": 18, "sugar": 12, "fat": 0.2, "sodium": 1},
     "unit_weight_g": 170},
    {"name": "אגס", "aliases": [],
     "nutrition_per_100g": {"calories": 57, "protein": 0.4, "carbohydrates": 15, "sugar": 9.8, "fat": 0.1, "sodium": 1},
     "unit_weight_g": 170},
    {"name": "שזיף", "aliases": ["שזיפים"],
     "nutrition_per_100g": {"calories": 46, "protein": 0.7, "carbohydrates": 11, "sugar": 9.9, "fat": 0.3, "sodium": 0},
     "unit_weight_g": 65},
    {"name": "אפרסק", "aliases": [],
     "nutrition_per_100g": {"calories": 39, "protein": 0.9, "carbohydrates": 10, "sugar": 8.4, "fat": 0.3, "sodium": 0},
     "unit_weight_g": 150},
    {"name": "קלמנטינה", "aliases": ["קלמנטינות", "מנדרינה"],
     "nutrition_per_100g": {"calories": 53, "protein": 0.9, "carbohydrates": 12, "sugar": 9.4, "fat": 0.3, "sodium": 1},
     "unit_weight_g": 75},
    # ===== שומנים ומרוחים =====
    {"name": "טחינה", "aliases": ["טחינה גולמית", "טחינה ביתית"],
     "nutrition_per_100g": {"calories": 592, "protein": 17, "carbohydrates": 20, "sugar": 0.5, "fat": 53, "sodium": 115}},
    {"name": "חומוס מוכן", "aliases": ["מטבל חומוס", "ממרח חומוס"],
     "nutrition_per_100g": {"calories": 177, "protein": 7.9, "carbohydrates": 20, "sugar": 0.5, "fat": 8, "sodium": 400}},
    {"name": "חמאת בוטנים", "aliases": ["ממרח בוטנים"],
     "nutrition_per_100g": {"calories": 598, "protein": 25, "carbohydrates": 20, "sugar": 9, "fat": 51, "sodium": 420}},
    {"name": "שמן קוקוס", "aliases": [],
     "nutrition_per_100g": {"calories": 862, "protein": 0, "carbohydrates": 0, "sugar": 0, "fat": 100, "sodium": 0}},
    {"name": "ממרח שקדים", "aliases": ["חמאת שקדים", "ממרח אגוזים"],
     "nutrition_per_100g": {"calories": 640, "protein": 21, "carbohydrates": 19, "sugar": 4.4, "fat": 56, "sodium": 4}},
    {"name": "גוואקמולי", "aliases": ["גואקמולי"],
     "nutrition_per_100g": {"calories": 155, "protein": 2, "carbohydrates": 9, "sugar": 0.7, "fat": 14, "sodium": 240}},
    # ===== חטיפים ומזון מהיר =====
    {"name": "גרנולה", "aliases": ["גרנולה ללא תוספות"],
     "nutrition_per_100g": {"calories": 471, "protein": 10, "carbohydrates": 64, "sugar": 22, "fat": 20, "sodium": 300}},
    {"name": "שוקולד מריר 85%", "aliases": ["שוקולד 85%", "שוקולד מריר"],
     "nutrition_per_100g": {"calories": 598, "protein": 8, "carbohydrates": 30, "sugar": 8, "fat": 50, "sodium": 10}},
    {"name": "קרקר", "aliases": ["קרקרים", "קרקר מלח"],
     "nutrition_per_100g": {"calories": 414, "protein": 9, "carbohydrates": 72, "sugar": 1, "fat": 12, "sodium": 800},
     "unit_weight_g": 5},
    {"name": "מצה", "aliases": ["מצות"],
     "nutrition_per_100g": {"calories": 395, "protein": 11, "carbohydrates": 83, "sugar": 0.5, "fat": 1.3, "sodium": 3},
     "unit_weight_g": 30},
    {"name": "ביסלי", "aliases": ["ביסלי גריל", "חטיף ביסלי"],
     "nutrition_per_100g": {"calories": 507, "protein": 10, "carbohydrates": 58, "sugar": 1, "fat": 26, "sodium": 620}},
    {"name": "במבה", "aliases": ["חטיף במבה"],
     "nutrition_per_100g": {"calories": 526, "protein": 10, "carbohydrates": 60, "sugar": 3, "fat": 29, "sodium": 378}},
    # ===== משקאות =====
    {"name": "מיץ תפוזים", "aliases": ["מיץ תפוז טבעי"],
     "nutrition_per_100g": {"calories": 45, "protein": 0.7, "carbohydrates": 10, "sugar": 8.4, "fat": 0.2, "sodium": 1}},
    {"name": "מיץ עגבניות", "aliases": ["מיץ עגבנייה"],
     "nutrition_per_100g": {"calories": 17, "protein": 0.9, "carbohydrates": 3.5, "sugar": 2.6, "fat": 0.1, "sodium": 223}},
    {"name": "קפה שחור", "aliases": ["קפה", "קפה בלי סוכר"],
     "nutrition_per_100g": {"calories": 2, "protein": 0.3, "carbohydrates": 0, "sugar": 0, "fat": 0, "sodium": 4}},
    {"name": "תה", "aliases": ["תה ירוק", "תה שחור"],
     "nutrition_per_100g": {"calories": 1, "protein": 0, "carbohydrates": 0.2, "sugar": 0, "fat": 0, "sodium": 3}},
]


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        db = json.load(f)

    existing = set()
    for item in db["ingredients"]:
        existing.add(item["name"].strip().lower())
        for alias in item.get("aliases", []):
            existing.add(alias.strip().lower())

    added = 0
    skipped = 0
    for product in NEW_PRODUCTS:
        name_lower = product["name"].strip().lower()
        if name_lower in existing:
            skipped += 1
            continue
        db["ingredients"].append(product)
        existing.add(name_lower)
        for alias in product.get("aliases", []):
            existing.add(alias.strip().lower())
        added += 1
        n = product["nutrition_per_100g"]
        print(f"  ✅ {product['name']}: {n['calories']} cal, {n['protein']}g protein")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)

    print(f"\nAdded {added}, skipped {skipped}.")
    print(f"Total products: {len(db['ingredients'])}")


if __name__ == "__main__":
    main()
