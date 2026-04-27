"""Pure calculation engine for converting per-100g nutrition into totals."""

from __future__ import annotations

from typing import Iterable

from app.models.ingredient import NutritionPer100g


_FIELDS: tuple[str, ...] = (
    "calories",
    "protein",
    "carbohydrates",
    "sugar",
    "fat",
    "sodium",
)


def for_quantity(per_100g: NutritionPer100g, grams: float) -> NutritionPer100g:
    """Scale per-100g values for an arbitrary gram amount.

    ``nutrition_for_quantity = nutrition_per_100g * grams / 100``
    """
    if grams <= 0:
        return NutritionPer100g()

    factor = grams / 100.0
    return NutritionPer100g(**{field: getattr(per_100g, field) * factor for field in _FIELDS})


def _zero() -> NutritionPer100g:
    return NutritionPer100g()


def sum_nutrition(items: Iterable[NutritionPer100g]) -> NutritionPer100g:
    totals = {field: 0.0 for field in _FIELDS}
    for item in items:
        for field in _FIELDS:
            totals[field] += getattr(item, field)
    return NutritionPer100g(**totals)


def per_100g(total: NutritionPer100g, total_grams: float) -> NutritionPer100g:
    if total_grams <= 0:
        return _zero()
    factor = 100.0 / total_grams
    return NutritionPer100g(**{field: getattr(total, field) * factor for field in _FIELDS})


def per_serving(total: NutritionPer100g, servings: int) -> NutritionPer100g:
    if servings <= 0:
        return _zero()
    return NutritionPer100g(**{field: getattr(total, field) / servings for field in _FIELDS})


def round_nutrition(value: NutritionPer100g, ndigits: int = 2) -> NutritionPer100g:
    return NutritionPer100g(
        **{field: round(getattr(value, field), ndigits) for field in _FIELDS}
    )
