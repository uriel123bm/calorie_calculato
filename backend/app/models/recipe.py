"""Pydantic models for recipe-level requests and responses."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from .ingredient import HebrewUnit, NutritionPer100g


class RecipeIngredient(BaseModel):
    name: str = Field(..., min_length=1, description="שם המצרך")
    quantity: float = Field(..., gt=0, description="כמות")
    unit: HebrewUnit = Field(..., description="יחידת מידה")
    nutrition_per_100g: NutritionPer100g = Field(
        ...,
        description="ערכים תזונתיים ל-100 גרם (יכול לבוא מהשרת או מעריכת המשתמש)",
    )
    unit_weight_g: Optional[float] = Field(
        None,
        gt=0,
        description="משקל ביחידה אחת בגרמים (רלוונטי כאשר היחידה היא 'יחידה')",
    )


class RecipeCalcRequest(BaseModel):
    recipe_name: Optional[str] = Field(None, description="שם המתכון")
    servings: int = Field(1, gt=0, description="מספר מנות")
    ingredients: List[RecipeIngredient]


class IngredientBreakdown(BaseModel):
    name: str
    quantity_in_grams: float
    nutrition: NutritionPer100g


class RecipeCalcResponse(BaseModel):
    recipe_name: Optional[str]
    servings: int
    total_weight_g: float
    total: NutritionPer100g
    per_100g: NutritionPer100g
    per_serving: NutritionPer100g
    breakdown: List[IngredientBreakdown]
