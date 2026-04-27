# מחשבון קלוריות למתכונים

A single-page Hebrew/RTL recipe calorie calculator. Users enter ingredient
name + quantity + unit, and the system **automatically detects** nutrition
values per 100 g and calculates totals for the whole recipe, per 100 g, and
per serving.

- **Frontend**: React 18 + TypeScript + Vite (RTL Hebrew, Heebo font)
- **Backend**: FastAPI (Python)
- **Auth / DB / Image upload**: none (intentionally — architecture is
  future-ready for adding them later)

## Auto-detection strategy

Resolution order in `backend/app/services/nutrition_lookup.py`:

1. **Local Hebrew dataset** (`backend/app/data/hebrew_ingredients.json`,
   ~50 common Israeli kitchen ingredients) — confidence 0.85–0.95.
2. **Open Food Facts** public search API — confidence 0.7.
3. **AI fallback** via OpenAI (`gpt-4o-mini`, JSON mode) — confidence 0.5.

If `OPENAI_API_KEY` is missing the AI tier returns zeros with confidence 0
(it never crashes), so the app stays usable even without a key as long as
the ingredient is found in steps 1 or 2.

## Project layout

```
Calorie_Calculator/
├── backend/                           FastAPI service
│   ├── app/
│   │   ├── main.py                    App factory + CORS
│   │   ├── api/routes/
│   │   │   ├── ingredients.py         POST /ingredients/analyze
│   │   │   └── recipes.py             POST /recipe/calculate
│   │   ├── models/                    Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── unit_converter.py      Hebrew unit → grams
│   │   │   ├── nutrition_lookup.py    local JSON + Open Food Facts
│   │   │   ├── ai_fallback.py         OpenAI-powered estimator
│   │   │   └── calculator.py          for_quantity / sum / per_100g / per_serving
│   │   ├── data/hebrew_ingredients.json
│   │   └── core/config.py             Settings from .env
│   ├── requirements.txt
│   └── .env.example
└── frontend/                          Vite + React + TS
    └── src/
        ├── App.tsx
        ├── components/                RecipeNameInput, IngredientTable, IngredientRow,
        │                              NutritionEditor, RecipeSummary, PdfExportButton
        ├── services/api.ts            axios client
        ├── utils/pdf.ts               html2canvas + jsPDF (Hebrew-safe)
        └── styles/App.css             RTL, calculator-style layout
```

## Setup

### Backend

Requires Python 3.11+ (tested on 3.14).

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env       # Windows
# cp .env.example .env       # macOS / Linux
# Edit .env and set OPENAI_API_KEY (optional but recommended)

uvicorn app.main:app --reload
# → http://localhost:8000  (Swagger UI at /docs)
```

### Frontend

Requires Node 18+.

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/ingredients/*` and `/recipe/*` to
`http://localhost:8000`, so just run both processes in parallel.

For production (or to point at a different backend) set
`VITE_API_BASE=https://your-api.example.com` before `npm run build`.

## API

### `POST /ingredients/analyze`

Request:

```json
{ "ingredient_name": "פתיבר", "quantity": 475, "unit": "גרם" }
```

Response:

```json
{
  "ingredient_name": "פתיבר",
  "nutrition_per_100g": { "calories": 430, "protein": 7, "carbohydrates": 75, "sugar": 22, "fat": 12, "sodium": 380 },
  "nutrition_for_quantity": { "calories": 2042.5, "protein": 33.25, ... },
  "quantity_in_grams": 475,
  "confidence": 0.95,
  "source": "local",
  "matched_name": "פתיבר"
}
```

### `POST /recipe/calculate`

Returns `total`, `per_100g`, `per_serving`, and a per-ingredient
`breakdown`. The frontend sends the (possibly user-edited) per-100 g
values so manual corrections in the UI are honored.

## Supported units

`גרם`, `מ"ל`, `כף` (15 g), `כפית` (5 g), `כוס` (240 g), `יחידה` (per-ingredient
weight from the dataset, default 100 g). All units are internally
converted to grams before nutrition calculation:

```
nutrition_for_quantity = nutrition_per_100g × quantity_in_grams ÷ 100
```

## PDF export

The "ייצוא ל-PDF" button rasterizes the recipe section with
`html2canvas` and embeds the image into a multi-page A4 PDF via `jsPDF`.
This sidesteps Hebrew/RTL font-embedding issues in jsPDF and produces a
PDF that matches the on-screen layout exactly (recipe name, ingredient
list, nutrition table, per-100 g and per-serving values).

## Future-ready architecture

- `nutrition_lookup.lookup()` is a single async entry point — a database
  source can be slotted in front of the JSON file without changing the
  routes.
- `models/recipe.py` is shaped for persistence (just add `id`,
  `created_at` later).
- Routes are stateless; an auth dependency can be added later via
  `Depends(...)` without restructuring.
