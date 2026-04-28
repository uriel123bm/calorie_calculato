"""AI-powered nutrition estimator (final fallback).

Uses OpenAI's chat completions with JSON mode. If the API key is missing or
the call fails, returns a low-confidence zero result rather than raising,
so the API can still respond gracefully.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass

from app.core.config import settings
from app.models.ingredient import NutritionPer100g, NutritionSource


logger = logging.getLogger(__name__)


@dataclass
class AIEstimate:
    nutrition: NutritionPer100g
    confidence: float
    source: NutritionSource
    matched_name: str


_PROMPT_SYSTEM = (
    "You are a nutrition database for Israeli home cooking. Given a food or ingredient "
    "name (often Hebrew), output average nutrition values per 100 grams of edible portion "
    "(not packed weight of a boxed product unless the phrase clearly names a branded item). "
    "Respond ONLY with a JSON object, no commentary, with these numeric keys: "
    "calories (kcal), protein (g), carbohydrates (g), sugar (g), fat (g), sodium (mg). "
    "Use 0 only for genuinely unknown macros. "
    "If the ingredient can be bought dry/soaked vs cooked (e.g. grains, pulses, couscous vs "
    "pearled couscous cooked), prefer typical dry/unprepared edible numbers per 100g raw "
    "unless the wording explicitly mentions cooked/prepared/soaked (מבושל, מוכן, מוגש). "
    "Do not swap bulgur, couscous, rice, pasta, quinoa, or lentils for one another—they differ."
)


def _build_user_prompt(ingredient_name: str) -> str:
    return (
        f"Ingredient phrase: {ingredient_name}\n"
        "Return JSON with keys only: calories, protein, carbohydrates, sugar, fat, sodium."
    )


def _zero_estimate(ingredient_name: str, source: NutritionSource = "ai_estimate") -> AIEstimate:
    return AIEstimate(
        nutrition=NutritionPer100g(),
        confidence=0.0,
        source=source,
        matched_name=ingredient_name,
    )


def _parse_response(text: str) -> NutritionPer100g:
    data = json.loads(text)

    def _num(key: str) -> float:
        value = data.get(key, 0)
        try:
            return max(float(value), 0.0)
        except (TypeError, ValueError):
            return 0.0

    return NutritionPer100g(
        calories=_num("calories"),
        protein=_num("protein"),
        carbohydrates=_num("carbohydrates"),
        sugar=_num("sugar"),
        fat=_num("fat"),
        sodium=_num("sodium"),
    )


async def estimate(ingredient_name: str) -> AIEstimate:
    """Ask the AI provider for a nutrition estimate."""
    if not settings.openai_api_key:
        logger.info("OPENAI_API_KEY not set; returning zero AI estimate.")
        return _zero_estimate(ingredient_name, source="unknown")

    try:
        from openai import AsyncOpenAI
    except ImportError:
        logger.warning("openai package not installed; returning zero estimate.")
        return _zero_estimate(ingredient_name, source="unknown")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": _PROMPT_SYSTEM},
                    {"role": "user", "content": _build_user_prompt(ingredient_name)},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            ),
            timeout=15.0,
        )
    except (asyncio.TimeoutError, Exception) as exc:  # noqa: BLE001
        logger.warning("AI fallback failed for %r: %s", ingredient_name, exc)
        return _zero_estimate(ingredient_name)

    try:
        content = response.choices[0].message.content or "{}"
        nutrition = _parse_response(content)
    except (json.JSONDecodeError, KeyError, IndexError) as exc:
        logger.warning("AI response parse failed: %s", exc)
        return _zero_estimate(ingredient_name)

    return AIEstimate(
        nutrition=nutrition,
        confidence=0.5,
        source="ai_estimate",
        matched_name=ingredient_name,
    )
