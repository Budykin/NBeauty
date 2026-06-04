from __future__ import annotations

import re


PHONE_ALLOWED_PATTERN = re.compile(r"^\+?[0-9\s()\-]+$")


def normalize_telephone_number(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    if not PHONE_ALLOWED_PATTERN.fullmatch(normalized):
        raise ValueError("Telephone number contains invalid characters")

    digits_count = sum(char.isdigit() for char in normalized)
    if digits_count < 5 or digits_count > 15:
        raise ValueError("Telephone number has invalid length")

    if normalized.count("+") > 1 or ("+" in normalized and not normalized.startswith("+")):
        raise ValueError("Telephone number has invalid plus sign placement")

    return normalized
