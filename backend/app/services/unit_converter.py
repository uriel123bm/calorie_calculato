"""Convert user-supplied quantities (in Hebrew units) to grams.

The conversions assume water-like density for volumetric units (`מ"ל`, `כף`,
`כפית`, `כוס`). Millilitre quantities are treated as mass in grams at ~1 g/mL.

For ``יחידה`` the gram weight comes from ``unit_weight_g`` in the **local**
ingredient dataset. **Keep it aligned with how users measure the same portion in
millilitres** — e.g. if one retail bottle is 330 mL, set ``unit_weight_g`` to
``330`` so that "1 יחידה" and "330 מ\"ל" yield the same total calories.
"""

from __future__ import annotations

from typing import Optional


# Conversion table: 1 <unit> = X grams.
# Volume-based units assume water density (1 g / mL).
_UNIT_TO_GRAMS: dict[str, float] = {
    "גרם": 1.0,
    "מ\"ל": 1.0,
    "כף": 15.0,
    "כפית": 5.0,
    "כוס": 240.0,
}


DEFAULT_UNIT_WEIGHT_G = 100.0


def to_grams(
    quantity: float,
    unit: str,
    unit_weight_g: Optional[float] = None,
) -> float:
    """Convert ``quantity`` of ``unit`` to grams.

    Args:
        quantity: Amount supplied by the user (must be > 0).
        unit: One of the supported Hebrew unit strings.
        unit_weight_g: Required when ``unit == "יחידה"`` to express the gram
            weight of a single piece of the ingredient. If not provided, falls
            back to ``DEFAULT_UNIT_WEIGHT_G``.

    Raises:
        ValueError: If ``quantity`` is not positive or ``unit`` is unknown.
    """

    if quantity <= 0:
        raise ValueError("quantity must be positive")

    normalized = unit.strip()

    if normalized == "יחידה":
        weight = unit_weight_g if unit_weight_g and unit_weight_g > 0 else DEFAULT_UNIT_WEIGHT_G
        return quantity * weight

    factor = _UNIT_TO_GRAMS.get(normalized)
    if factor is None:
        raise ValueError(f"Unsupported unit: {unit!r}")

    return quantity * factor


SUPPORTED_UNITS: tuple[str, ...] = (
    "גרם",
    "מ\"ל",
    "כף",
    "כפית",
    "כוס",
    "יחידה",
)
