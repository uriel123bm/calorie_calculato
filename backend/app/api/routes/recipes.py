"""Routes for recipe-level calculation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.recipe import (
    IngredientBreakdown,
    RecipeCalcRequest,
    RecipeCalcResponse,
)
from app.services import calculator, unit_converter


router = APIRouter(prefix="/recipe", tags=["recipe"])


@router.post("/calculate", response_model=RecipeCalcResponse)
def calculate_recipe(payload: RecipeCalcRequest) -> RecipeCalcResponse:
    """Aggregate ingredient nutrition into total / per-100g / per-serving."""

    if not payload.ingredients:
        raise HTTPException(status_code=400, detail="המתכון חייב לכלול לפחות מצרך אחד")

    breakdown: list[IngredientBreakdown] = []
    per_ingredient_totals = []
    total_grams = 0.0

    for ing in payload.ingredients:
        try:
            grams = unit_converter.to_grams(ing.quantity, ing.unit, ing.unit_weight_g)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        scaled = calculator.for_quantity(ing.nutrition_per_100g, grams)
        per_ingredient_totals.append(scaled)
        total_grams += grams

        breakdown.append(
            IngredientBreakdown(
                name=ing.name,
                quantity_in_grams=round(grams, 2),
                nutrition=calculator.round_nutrition(scaled),
            )
        )

    total = calculator.sum_nutrition(per_ingredient_totals)
    p100 = calculator.per_100g(total, total_grams)
    pserv = calculator.per_serving(total, payload.servings)

    return RecipeCalcResponse(
        recipe_name=payload.recipe_name,
        servings=payload.servings,
        total_weight_g=round(total_grams, 2),
        total=calculator.round_nutrition(total),
        per_100g=calculator.round_nutrition(p100),
        per_serving=calculator.round_nutrition(pserv),
        breakdown=breakdown,
    )
