import { useCallback, useMemo, useRef, useState } from "react";
import { AuthPage } from "./components/AuthPage";
import { DailyTracker } from "./components/DailyTracker";
import { IngredientTable } from "./components/IngredientTable";
import { JournalPage } from "./components/JournalPage";
import { MealsSection } from "./components/MealsSection";
import { MyRecipesSection } from "./components/MyRecipesSection";
import { PdfExportButton } from "./components/PdfExportButton";
import { RecipeNameInput } from "./components/RecipeNameInput";
import { RecipeSummary } from "./components/RecipeSummary";
import { useAuth } from "./context/AuthContext";
import { useDailyTracker } from "./hooks/useDailyTracker";
import { useIngredientRows } from "./hooks/useIngredientRows";
import { useSavedRecipes } from "./hooks/useSavedRecipes";
import { EMPTY_NUTRITION, NutritionPer100g } from "./types";

type TabId = "home" | "recipe" | "meals" | "journal";

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "home",    icon: "monitoring",      label: "ראשי"    },
  { id: "recipe",  icon: "restaurant_menu", label: "מתכון"   },
  { id: "meals",   icon: "lunch_dining",    label: "ארוחות"  },
  { id: "journal", icon: "menu_book",       label: "יומן"    },
];

const FIELDS: (keyof NutritionPer100g)[] = [
  "calories", "protein", "carbohydrates", "sugar", "fat", "sodium",
];
const DEFAULT_ROW_COUNT = 4;

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="app-loading-screen">
        <span className="app-loading-spinner" />
        <p>טוען...</p>
      </div>
    );
  }

  // Not logged in → show auth screen
  if (!user) {
    return <AuthPage />;
  }

  return <AppShell userId={user.id} username={user.username} onLogout={logout} />;
}

// ── Inner shell (only rendered when logged in) ──────────

function AppShell({
  userId,
  username,
  onLogout,
}: {
  userId: string;
  username: string;
  onLogout: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [recipeName, setRecipeName] = useState("");
  const [servings, setServings] = useState(1);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [saveDuplicate, setSaveDuplicate] = useState(false);

  const recipe        = useIngredientRows(DEFAULT_ROW_COUNT);
  const daily         = useDailyTracker(userId);
  const savedRecipes  = useSavedRecipes(userId);
  const exportTargetRef = useRef<HTMLDivElement>(null);

  const perServing = useMemo<NutritionPer100g>(() => {
    if (servings <= 0) return { ...EMPTY_NUTRITION };
    return FIELDS.reduce((acc, k) => {
      acc[k] = recipe.total[k] / servings;
      return acc;
    }, {} as NutritionPer100g);
  }, [recipe.total, servings]);

  const hasFilledRows = recipe.rows.some(
    (r) => r.name.trim() && r.quantity && Number(r.quantity) > 0
  );

  const isDirty =
    recipeName.trim() !== "" ||
    servings !== 1 ||
    recipe.rows.length !== DEFAULT_ROW_COUNT ||
    recipe.rows.some((r) => r.name.trim() !== "" || r.quantity !== "" || r.status !== "idle");

  const handleReset = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm("האם לנקות את כל הערכים ולהתחיל מתכון חדש?");
      if (!ok) return;
    }
    setRecipeName("");
    setServings(1);
    setRecipeSaved(false);
    recipe.reset(DEFAULT_ROW_COUNT);
  }, [isDirty, recipe]);

  const handleSaveRecipe = useCallback(() => {
    if (!hasFilledRows || recipe.total.calories <= 0) return;
    setSaveDuplicate(false);
    const result = savedRecipes.saveRecipe(recipeName, recipe.totalGrams, recipe.per100g, servings);
    if (result === "duplicate") {
      setSaveDuplicate(true);
      setTimeout(() => setSaveDuplicate(false), 4000);
      return;
    }
    setRecipeSaved(true);
    setTimeout(() => setRecipeSaved(false), 3000);
  }, [hasFilledRows, recipe, recipeName, servings, savedRecipes]);

  return (
    <div className="app-shell">
      {/* Fixed glass header */}
      <header className="app-header">
        <h1>
          <span className="material-symbols-outlined">nutrition</span>
          מחשבון קלוריות
        </h1>
        <div className="header-user">
          <span className="header-username">{username}</span>
          <button
            type="button"
            className="header-logout"
            onClick={onLogout}
            title="התנתק"
            aria-label="התנתק"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </header>

      <main className="app-pages">

        {/* ── HOME ── */}
        {activeTab === "home" && (
          <DailyTracker
            state={daily.state}
            setTarget={daily.setTarget}
            addEntry={daily.addEntry}
            removeEntry={daily.removeEntry}
            resetDay={daily.resetDay}
          />
        )}

        {/* ── RECIPE ── */}
        {activeTab === "recipe" && (
          <div className="page-container">
            <div className="page-hero">
              <span className="material-symbols-outlined page-hero-icon">restaurant_menu</span>
              <div>
                <h2 className="page-title">מחשבון מתכונים</h2>
                <p className="page-subtitle">הכניסו מצרכים — שמרו מתכון לשימוש בארוחות</p>
              </div>
            </div>

            <div ref={exportTargetRef}>
              <RecipeNameInput value={recipeName} onChange={(v) => { setRecipeName(v); setRecipeSaved(false); setSaveDuplicate(false); }} />

              <section className="section">
                <h2>
                  <span className="material-symbols-outlined">format_list_bulleted</span>
                  רשימת מצרכים
                </h2>
                <IngredientTable
                  rows={recipe.rows}
                  onPatchRow={recipe.patchRow}
                  onRemoveRow={recipe.removeRow}
                  onAddRow={recipe.addRow}
                  onAnalyzeRow={recipe.analyzeRow}
                  onNutritionEdit={recipe.handleNutritionEdit}
                />
              </section>

              <RecipeSummary
                recipeName={recipeName}
                servings={servings}
                totalWeightG={recipe.totalGrams}
                total={recipe.total}
                per100g={recipe.per100g}
                perServing={perServing}
                onServingsChange={setServings}
              />
            </div>

            <div className="actions-bar">
              <button
                type="button"
                className="ghost"
                onClick={handleReset}
                disabled={!isDirty}
              >
                מתכון חדש
              </button>

              <button
                type="button"
                className={`primary save-recipe-btn${recipeSaved ? " saved" : ""}`}
                onClick={handleSaveRecipe}
                disabled={!hasFilledRows || recipe.total.calories <= 0 || recipeSaved}
                title="שמור מתכון זה במאגר האישי שלך"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>
                  {recipeSaved ? "check_circle" : "bookmark_add"}
                </span>
                {recipeSaved ? "נשמר!" : "שמור מתכון"}
              </button>

              <PdfExportButton
                targetRef={exportTargetRef}
                filename={`${recipeName.trim() || "מתכון"}.pdf`}
                disabled={!hasFilledRows}
              />
            </div>

            {recipeSaved && (
              <div className="save-success-banner">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                המתכון "{recipeName || "ללא שם"}" נשמר! תמצאו אותו בעמוד <strong>ארוחות ← המתכונים שלי</strong>.
              </div>
            )}
            {saveDuplicate && (
              <div className="save-duplicate-banner">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
                מתכון בשם "{recipeName || "ללא שם"}" כבר קיים במאגר. שנו את השם כדי לשמור גרסה חדשה.
              </div>
            )}
          </div>
        )}

        {/* ── MEALS ── */}
        {activeTab === "meals" && (
          <div className="page-container">
            <div className="page-hero">
              <span className="material-symbols-outlined page-hero-icon">lunch_dining</span>
              <div>
                <h2 className="page-title">ארוחות</h2>
                <p className="page-subtitle">הוסיפו ארוחות ומתכונים שמורים ליומן היומי</p>
              </div>
            </div>

            {/* My saved recipes — pick grams → add to daily */}
            <MyRecipesSection
              recipes={savedRecipes.recipes}
              onDeleteRecipe={savedRecipes.deleteRecipe}
              onAddToDaily={daily.addEntry}
            />

            {/* Freestyle meals */}
            <MealsSection userId={userId} onAddToDaily={daily.addEntry} />
          </div>
        )}

        {/* ── JOURNAL ── */}
        {activeTab === "journal" && (
          <JournalPage
            today={daily.state}
            history={daily.history}
            onRemoveEntry={daily.removeEntry}
            onResetDay={daily.resetDay}
          />
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="bottom-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
          >
            <span className="material-symbols-outlined">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
