import urllib.request, json

tests = [
    ("egg",           "ביצה",          1, "יחידה"),
    ("tuna_can",      "קופסת טונה",    1, "יחידה"),
    ("protein_snack", "מעדן חלבון",    1, "יחידה"),
    ("protein_drink", "משקה חלבון",    1, "יחידה"),
]

for label, name, qty, unit in tests:
    body = json.dumps({"ingredient_name": name, "quantity": qty, "unit": unit}).encode()
    req = urllib.request.Request(
        "http://localhost:8000/ingredients/analyze",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        d = json.loads(resp.read())
        n = d["nutrition_for_quantity"]
        cal = round(n["calories"])
        pro = round(n["protein"], 1)
        src = d["source"]
        print(f"{label} ({name}): {cal} cal, {pro}g protein | source={src}")
