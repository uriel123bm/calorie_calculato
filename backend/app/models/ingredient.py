"""Pydantic models for ingredients and nutrition values."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


HebrewUnit = Literal["גרם", "מ\"ל", "כף", "כפית", "כוס", "יחידה"]


NutritionSource = Literal["local", "openfoodfacts", "ai_estimate", "manual", "unknown"]


class NutritionPer100g(BaseModel):
    """Nutritional values per 100 grams of ingredient."""

    calories: float = Field(0, ge=0, description="קלוריות")
    protein: float = Field(0, ge=0, description="חלבון (גרם)")
    carbohydrates: float = Field(0, ge=0, description="פחמימות (גרם)")
    sugar: float = Field(0, ge=0, description="סוכר (גרם)")
    fat: float = Field(0, ge=0, description="שומן (גרם)")
    sodium: float = Field(0, ge=0, description="נתרן (מ\"ג)")

    @field_validator(
        "calories", "protein", "carbohydrates", "sugar", "fat", "sodium",
        mode="before",
    )
    @classmethod
    def _coerce_none_to_zero(cls, v: object) -> object:
        return 0 if v is None else v


class AnalyzeRequest(BaseModel):
    ingredient_name: str = Field(..., min_length=1, description="שם המצרך")
    quantity: float = Field(..., gt=0, description="כמות")
    unit: HebrewUnit = Field(..., description="יחידת מידה")


class AnalyzeResponse(BaseModel):
    ingredient_name: str
    nutrition_per_100g: NutritionPer100g
    nutrition_for_quantity: NutritionPer100g
    quantity_in_grams: float
    confidence: float = Field(..., ge=0, le=1)
    source: NutritionSource
    matched_name: Optional[str] = None
    unit_weight_g: Optional[float] = Field(
        None,
        description="Grams per יחידה when known from local dataset (optional).",
    )
