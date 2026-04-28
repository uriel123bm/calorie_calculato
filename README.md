# מחשבון קלוריות למתכונים

A single-page Hebrew/RTL recipe calorie calculator. Users enter ingredient
name + quantity + unit, and the system **automatically detects** nutrition
values per 100 g and calculates totals for the whole recipe, per 100 g, and
per serving.

- **Frontend**: React 18 + TypeScript + Vite (RTL Hebrew, Heebo font)
- **Backend**: FastAPI (Python)
- **Auth**: JWT access token + httpOnly refresh cookie; user data in SQLite
  (local) or Postgres when `DATABASE_URL` is set (`app/db/database.py`).

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

Run frontend tests:

```bash
npm run test
```

The Vite dev server proxies `/ingredients/*` and `/recipe/*` to
`http://localhost:8000`, so just run both processes in parallel.

For production (or to point at a different backend) set
`VITE_API_BASE=https://your-api.example.com` before `npm run build`.

## Testing and CI

- Frontend tests run with Vitest (`frontend/src/components/__tests__`).
- Backend smoke tests run with Pytest (`backend/tests`).
- GitHub Actions CI runs on pushes/PRs to `main` and fails if build/tests fail.

Useful root scripts:

```bash
npm run test
npm run verify:prod
```

`verify:prod` checks that the production deployment serves expected CSS markers
for critical UI updates.

## PWA update behavior

The app uses `vite-plugin-pwa` with `autoUpdate` and now shows an in-app prompt
when a new service-worker version is ready. Users can click "עדכן עכשיו" to
refresh into the newest build, reducing stale-cache incidents after deployments.

### DevTools console noise (harmless “message channel closed”)

If you see:

`A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`

it is **almost always** from a **Chrome extension** (password manager, ad blocker, grammar tools, etc.) talking to the page over `chrome.runtime.sendMessage` — **not** from this repo’s code (there is no `runtime.onMessage` / `postMessage` bridge in the app). Try an **Incognito** window with extensions disabled, or another browser, to confirm. It does not mean the API or PWA is misconfigured.

## Production deploy flow

1. Merge to `main` (or push directly for hotfixes).
2. Wait for Vercel production deploy to reach `READY`.
3. Run:

```bash
npm run verify:prod
```

4. If verification passes, do a hard refresh in browser (`Ctrl+F5`) and check
the home tracker plus manual-add flow.

### Vercel environment variables (Production)

Set these in **Project → Settings → Environment Variables** for **Production**
(after changing env vars, redeploy the latest deployment).

| Variable | Required | Example / note |
|----------|----------|----------------|
| `JWT_SECRET` | Yes | Long random string (`python scripts/generate_jwt_secret.py`). Stable across deploys. |
| `COOKIE_SECURE` | Yes | `true` (HTTPS). |
| `COOKIE_SAMESITE` | Yes | `lax` (same site as the app). |
| `CORS_ORIGINS` | Recommended | Your site origin, e.g. `https://calorie-calculato.vercel.app` (comma-separate multiple). |
| `DATABASE_URL` | Strongly recommended | PostgreSQL URL from Neon, Supabase, Railway, etc. Without it, serverless SQLite is ephemeral. |
| `OPENAI_API_KEY` | Optional | Enables AI nutrition fallback when local + Open Food Facts miss. |
| `AUTH_COOKIE_PATH` | Optional | Default `/` in code; only override if your API path layout differs. |

The frontend build uses [`frontend/.env.production`](frontend/.env.production) (`VITE_API_BASE=/_/backend`) so the browser calls the API under the same host. Do not commit secrets; only non-secret build vars belong in tracked `.env.*` files.

**Manual steps after configuring env:** Redeploy, then in the browser use **Ctrl+F5** and sign in again so cookies/tokens match the new settings.

### Provision Postgres for production

Create a Postgres instance (e.g. [Neon](https://neon.tech) or Supabase), copy the connection string into `DATABASE_URL` for the Vercel **backend** runtime, redeploy. Local development can keep `DATABASE_URL` empty (SQLite).

## Observability (Sentry)

Sentry is environment-gated:

- Frontend: set `VITE_SENTRY_DSN` (+ optional env/sample-rate vars).
- Backend: set `SENTRY_DSN` (+ optional env/sample-rate vars).

When DSN is missing, Sentry is disabled automatically.

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
