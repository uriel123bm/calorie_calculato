"""Tests for local substring ranking and OFF scoring heuristics."""

import app.services.ai_fallback as ai_fallback

from app.services import calculator
from app.services.nutrition_lookup import (
    _confidence_from_off_score,
    _local_lookup,
    _off_match_score,
    _substring_rank_key,
)
from app.services.unit_converter import to_grams


def test_substring_rank_prefers_shorter_name_when_user_query_is_prefix() -> None:
    """For query 'בורגול', a shorter catalog phrase ranks above a longer one (tier 2)."""
    wider = _substring_rank_key("בורגול", "בורגול מבושל", 0)
    narrower = _substring_rank_key("בורגול", "בורגול גס", 1)
    assert wider is not None and narrower is not None
    assert narrower > wider


def test_local_exact_bulgur_matches_dry_dataset_entry() -> None:
    hit = _local_lookup("בורגול")
    assert hit is not None
    assert hit.source == "local"
    assert hit.confidence >= 0.9
    assert hit.nutrition.calories >= 330
    assert hit.matched_name in ("בורגול", "בורגל")


def test_protein_shake_unit_weight_matches_ml_bottle() -> None:
    """משקה חלבון: אותה משקל בעזרת יחידה ובעזרת מיל מתאימים למאגר (ללא פער ספירה)."""
    hit = _local_lookup("משקה חלבון")
    assert hit is not None and hit.unit_weight_g is not None
    uw = hit.unit_weight_g
    grams_from_unit = to_grams(1, "יחידה", uw)
    grams_from_ml = to_grams(uw, "מ\"ל", None)
    assert abs(grams_from_unit - grams_from_ml) < 1e-6


def test_protein_shake_one_bottle_330_ml_targets_cal_protein_band() -> None:
    """בקבוק טיפוסי ~330 ג — כ־135 קק״ל ו־כ־25 ג חלבון (יחידה 1 ≡ 330 מל)."""
    hit = _local_lookup("משקה חלבון")
    assert hit is not None and hit.unit_weight_g == 330.0
    g330 = float(hit.unit_weight_g)
    qty = calculator.for_quantity(hit.nutrition, g330)
    assert 132 <= qty.calories <= 138
    assert 24 <= qty.protein <= 26


def test_local_alias_boiled_bulgur() -> None:
    hit = _local_lookup("בורגול מוכן")
    assert hit is not None
    assert hit.source == "local"
    assert hit.nutrition.calories < 150


def test_off_score_exact_equals_query() -> None:
    p = {"product_name_he": "יאוריט 3%", "product_name": "Yaourt"}
    assert _off_match_score("יאוריט 3%", p) >= 0.95


def test_off_score_token_overlap_hebrew_boost() -> None:
    p = {"product_name_he": "חלב השפה תל אביב 3%", "product_name": "Milk 3"}
    score = _off_match_score("חלב", p)
    assert score >= 0.45


def test_confidence_band() -> None:
    assert _confidence_from_off_score(0.0) == 0.55
    assert _confidence_from_off_score(1.0) <= 0.73


def test_ai_prompt_warns_dry_vs_cooked_and_distinct_grains() -> None:
    p = ai_fallback._PROMPT_SYSTEM  # noqa: SLF001
    low = p.lower()
    assert "cooked" in low or "מבושל" in p
    assert "bulgur" in low or "בורגול" in p
