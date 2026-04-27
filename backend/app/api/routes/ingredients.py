"""Routes for ingredient-level nutrition analysis."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.ingredient import AnalyzeRequest, AnalyzeResponse, NutritionPer100g
from app.services import ai_fallback, calculator, nutrition_lookup, unit_converter


router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ingredient(payload: AnalyzeRequest) -> AnalyzeResponse:
    """Auto-detect nutrition values per 100 g and scale to the requested quantity."""

    name = payload.ingredient_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="שם המצרך חסר")

    result = await nutrition_lookup.lookup(name)

    if result is None:
        ai = await ai_fallback.estimate(name)
        nutrition_per_100g: NutritionPer100g = ai.nutrition
        confidence = ai.confidence
        source = ai.source
        matched_name = ai.matched_name
        unit_weight_g = None
    else:
        nutrition_per_100g = result.nutrition
        confidence = result.confidence
        source = result.source
        matched_name = result.matched_name
        unit_weight_g = result.unit_weight_g

    try:
        grams = unit_converter.to_grams(payload.quantity, payload.unit, unit_weight_g)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    nutrition_for_quantity = calculator.round_nutrition(
        calculator.for_quantity(nutrition_per_100g, grams)
    )

    return AnalyzeResponse(
        ingredient_name=name,
        nutrition_per_100g=calculator.round_nutrition(nutrition_per_100g),
        nutrition_for_quantity=nutrition_for_quantity,
        quantity_in_grams=round(grams, 2),
        confidence=confidence,
        source=source,
        matched_name=matched_name,
    )
