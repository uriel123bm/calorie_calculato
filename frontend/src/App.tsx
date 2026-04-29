import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthPage } from "./components/AuthPage";
import { DailyTracker } from "./components/DailyTracker";
import { IngredientTable } from "./components/IngredientTable";
import { JournalPage } from "./components/JournalPage";
import { MealsSection } from "./components/MealsSection";
import { MyProductsSection } from "./components/MyProductsSection";
import { MyRecipesSection } from "./components/MyRecipesSection";
import { PdfExportButton } from "./components/PdfExportButton";
import { ProgressPage } from "./components/ProgressPage";
import { RecipeNameInput } from "./components/RecipeNameInput";
import { RecipeSummary } from "./components/RecipeSummary";
import { useAuth } from "./context/AuthContext";
import { useBodyMetrics } from "./hooks/useBodyMetrics";
import { useDailyTracker } from "./hooks/useDailyTracker";
import { useIngredientRows } from "./hooks/useIngredientRows";
import { useSavedRecipes } from "./hooks/useSavedRecipes";
import { useUserProducts } from "./hooks/useUserProducts";
import type { IngredientRowState, NutritionPer100g } from "./types";
import { divideTotalsByServings } from "./utils/nutritionMath";

type TabId = "home" | "recipe" | "meals" | "products" | "progress" | "journal";

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "home",     icon: "monitoring",      label: "ראשי"     },
  { id: "recipe",   icon: "restaurant_menu", label: "מתכון"    },
  { id: "meals",    icon: "lunch_dining",    label: "ארוחות"   },
  { id: "products", icon: "inventory_2",     label: "מוצרים"   },
  { id: "progress", icon: "show_chart",      label: "התקדמות"  },
  { id: "journal",  icon: "menu_book",       label: "יומן"     },
];

const DEFAULT_ROW_COUNT = 4;
const recipeDraftKey = (uid: string) => `user_${uid}:recipe_draft:v1`;
const onboardingSeenKey = (uid: string) => `user_${uid}:onboarding_seen:v1`;

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
  type DeletedRowUndo = {
    row: IngredientRowState;
    index: number;
  };
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [recipeName, setRecipeName] = useState("");
  const [servings, setServings] = useState(1);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [saveDuplicate, setSaveDuplicate] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [dontShowOnboardingAgain, setDontShowOnboardingAgain] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const recipe        = useIngredientRows(DEFAULT_ROW_COUNT);
  const daily         = useDailyTracker(userId);
  const savedRecipes  = useSavedRecipes(userId);
  const userProducts  = useUserProducts(userId);
  const body          = useBodyMetrics(userId);
  const exportTargetRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const undoTimeoutRef = useRef<number | null>(null);
  const [deletedRowUndo, setDeletedRowUndo] = useState<DeletedRowUndo | null>(null);
  const onboardingEndRef = useRef<number | null>(null);

  const onboardingSteps = useMemo(
    () => [
      "מוסיפים מצרך עם שם, כמות ויחידה — והמערכת מזהה ערכים אוטומטית.",
      "אפשר ללחוץ Enter כדי לעבור בין השדות במהירות ולהוסיף שורות חדשות.",
      "בסיום שומרים מתכון ומוסיפים אותו לארוחות בלחיצה אחת.",
    ],
    []
  );

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current !== null) {
        window.clearTimeout(undoTimeoutRef.current);
      }
      if (onboardingEndRef.current !== null) {
        window.clearTimeout(onboardingEndRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      const alreadySeen = localStorage.getItem(onboardingSeenKey(userId));
      if (!alreadySeen) {
        setShowOnboarding(true);
        setOnboardingStep(0);
        setDontShowOnboardingAgain(false);
        setActiveTab("recipe");
      }
    } catch {
      // ignore storage errors
    }
  }, [userId]);

  useEffect(() => {
    if (!showOnboarding) return;
    onboardingEndRef.current = window.setTimeout(() => {
      setShowOnboarding(false);
      if (dontShowOnboardingAgain) {
        try {
          localStorage.setItem(onboardingSeenKey(userId), "1");
        } catch {
          // ignore storage errors
        }
      }
    }, 20000);
    return () => {
      if (onboardingEndRef.current !== null) {
        window.clearTimeout(onboardingEndRef.current);
        onboardingEndRef.current = null;
      }
    };
  }, [dontShowOnboardingAgain, showOnboarding, userId]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (dontShowOnboardingAgain) {
      try {
        localStorage.setItem(onboardingSeenKey(userId), "1");
      } catch {
        // ignore storage errors
      }
    }
  }, [dontShowOnboardingAgain, userId]);

  const nextOnboardingStep = useCallback(() => {
    setOnboardingStep((prev) => {
      if (prev >= onboardingSteps.length - 1) {
        dismissOnboarding();
        return prev;
      }
      return prev + 1;
    });
  }, [dismissOnboarding, onboardingSteps.length]);

  useEffect(() => {
    const raw = localStorage.getItem(recipeDraftKey(userId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        recipeName?: string;
        servings?: number;
        rows?: typeof recipe.rows;
      };
      if (typeof parsed.recipeName === "string") {
        setRecipeName(parsed.recipeName);
      }
      if (typeof parsed.servings === "number" && Number.isFinite(parsed.servings) && parsed.servings > 0) {
        setServings(parsed.servings);
      }
      if (Array.isArray(parsed.rows)) {
        recipe.hydrateRows(parsed.rows);
      }
    } catch {
      // ignore malformed drafts
    }
    // Run only when user changes; draft hydration should happen once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        recipeDraftKey(userId),
        JSON.stringify({
          recipeName,
          servings,
          rows: recipe.rows,
        })
      );
    } catch {
      // ignore storage quota/availability errors
    }
  }, [userId, recipeName, servings, recipe.rows]);

  const perServing = useMemo<NutritionPer100g>(
    () => divideTotalsByServings(recipe.total, servings),
    [recipe.total, servings]
  );

  const hasFilledRows = recipe.rows.some(
    (r) => r.name.trim() && r.quantity && Number(r.quantity) > 0
  );
  const nameSuggestions = useMemo(() => {
    const base = [
      "פתיבר", "ביצה L", "קמח", "סוכר", "שמן זית", "חלב", "קקאו", "אגוזים",
      "תפוח", "בננה", "אורז", "שקדים", "דבש", "יוגורט", "טונה", "גזר", "שום", "בצל", "עגבנייה",
    ];
    const fromRows = recipe.rows
      .map((r) => r.name.trim())
      .filter((name): name is string => name.length > 0);
    const fromLibrary = userProducts.products.map((p) => p.name.trim()).filter(Boolean);
    return Array.from(new Set([...fromLibrary, ...fromRows, ...base]));
  }, [recipe.rows, userProducts.products]);

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
    setSaveDuplicate(false);
    setDeletedRowUndo(null);
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    recipe.reset(DEFAULT_ROW_COUNT);
    try {
      localStorage.removeItem(recipeDraftKey(userId));
    } catch {
      // ignore storage failures
    }
  }, [isDirty, recipe, userId]);

  const handleRemoveRowWithUndo = useCallback((id: string) => {
    const index = recipe.rows.findIndex((r) => r.id === id);
    if (index < 0) return;
    const removed = recipe.rows[index];
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
    }
    setDeletedRowUndo({ row: removed, index });
    recipe.removeRow(id);
    undoTimeoutRef.current = window.setTimeout(() => {
      setDeletedRowUndo(null);
      undoTimeoutRef.current = null;
    }, 5000);
  }, [recipe]);

  const handleUndoRemoveRow = useCallback(() => {
    if (!deletedRowUndo) return;
    const current = recipe.rows.slice();
    const existingIdx = current.findIndex((r) => r.id === deletedRowUndo.row.id);
    if (existingIdx >= 0) {
      current[existingIdx] = deletedRowUndo.row;
    } else {
      const idx = Math.max(0, Math.min(deletedRowUndo.index, current.length));
      current.splice(idx, 0, deletedRowUndo.row);
    }
    recipe.hydrateRows(current);
    setDeletedRowUndo(null);
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }, [deletedRowUndo, recipe]);

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

  const handleCheckUpdates = useCallback(() => {
    window.dispatchEvent(new CustomEvent("pwa:check-update"));
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!settingsMenuRef.current) return;
      if (!settingsMenuRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("click", onDocClick);
    return () => window.removeEventListener("click", onDocClick);
  }, [settingsOpen]);

  return (
    <div className="app-shell">
      {/* Fixed glass header */}
      <header className="app-header">
        <h1>
          <span className="material-symbols-outlined">nutrition</span>
          מחשבון קלוריות
        </h1>
        <div className="header-user" ref={settingsMenuRef}>
          <span className="header-username">{username}</span>
          <button
            type="button"
            className="header-settings"
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen((prev) => !prev);
            }}
            title="הגדרות"
            aria-label="הגדרות"
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
          {settingsOpen && (
            <div className="settings-menu" role="menu" aria-label="תפריט הגדרות">
              <button type="button" className="settings-menu-item" role="menuitem" onClick={handleCheckUpdates}>
                בדוק עדכונים
              </button>
              <button
                type="button"
                className="settings-menu-item"
                role="menuitem"
                onClick={() => {
                  setShowAbout(true);
                  setSettingsOpen(false);
                }}
              >
                אודות
              </button>
              <button
                type="button"
                className="settings-menu-item settings-menu-item-danger"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false);
                  void onLogout();
                }}
              >
                התנתק
              </button>
            </div>
          )}
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
            personalProducts={userProducts.products}
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
                  onRemoveRow={handleRemoveRowWithUndo}
                  onAddRow={recipe.addRow}
                  onAnalyzeRow={recipe.analyzeRow}
                  onNutritionEdit={recipe.handleNutritionEdit}
                  onSubmitLastRow={recipe.addRow}
                  nameSuggestions={nameSuggestions}
                  hint='טיפ: ביחידת "יחידה" הזינו משקל טיפוסי למנה אחת (למשל ביצה ~55 ג׳, תפוח ~180 ג׳). ברירת המחדל 100 ג׳ מתאימה לעיתים רק למוצרים ארוזים.'
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

            <div className="actions-bar recipe-actions-bar">
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
            {deletedRowUndo && (
              <div className="save-success-banner">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  undo
                </span>
                שורת מצרך נמחקה.
                <button type="button" className="ghost undo-inline-btn" onClick={handleUndoRemoveRow}>
                  בטל
                </button>
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
            <MealsSection userId={userId} onAddToDaily={daily.addEntry} personalProducts={userProducts.products} />
          </div>
        )}

        {/* ── PRODUCTS ── */}
        {activeTab === "products" && (
          <MyProductsSection
            products={userProducts.products}
            onAddProduct={userProducts.addProduct}
            onDeleteProduct={userProducts.deleteProduct}
            onAddToDaily={daily.addEntry}
          />
        )}

        {/* ── PROGRESS ── */}
        {activeTab === "progress" && <ProgressPage body={body} />}

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

      {showOnboarding && (
        <div className="onboarding-overlay" role="dialog" aria-live="polite" aria-label="הדרכה קצרה">
          <div className="onboarding-card">
            <div className="onboarding-head">
              <strong>הדרכה קצרה (20 שניות)</strong>
              <button type="button" className="ghost onboarding-close" onClick={dismissOnboarding}>
                סגור
              </button>
            </div>
            <p className="onboarding-text">{onboardingSteps[onboardingStep]}</p>
            <div className="onboarding-dots" aria-hidden="true">
              {onboardingSteps.map((_, idx) => (
                <span key={idx} className={idx === onboardingStep ? "active" : ""} />
              ))}
            </div>
            <div className="onboarding-actions">
              <label className="onboarding-dont-show">
                <input
                  type="checkbox"
                  checked={dontShowOnboardingAgain}
                  onChange={(e) => setDontShowOnboardingAgain(e.target.checked)}
                />
                אל תציג שוב
              </label>
              <button
                type="button"
                className="ghost"
                onClick={nextOnboardingStep}
              >
                {onboardingStep === onboardingSteps.length - 1 ? "סיום" : "הבא"}
              </button>
              <button type="button" className="primary" onClick={dismissOnboarding}>
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="onboarding-overlay" role="dialog" aria-label="אודות האפליקציה">
          <div className="onboarding-card">
            <div className="onboarding-head">
              <strong>אודות</strong>
              <button type="button" className="ghost onboarding-close" onClick={() => setShowAbout(false)}>
                סגור
              </button>
            </div>
            <p className="onboarding-text">
              מחשבון קלוריות למתכונים ומעקב יומי.
              <br />
              כולל זיהוי מצרכים, מוצרים אישיים, שמירת מתכונים והתקדמות לאורך זמן.
            </p>
          </div>
        </div>
      )}

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
