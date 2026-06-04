from __future__ import annotations

import re


PHONE_ALLOWED_PATTERN = re.compile(r"^\+?[0-9\s()\-]+$")
TELEPHONE_NUMBER_ERROR = "Укажи корректный номер телефона"


def normalize_telephone_number(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(TELEPHONE_NUMBER_ERROR)

    normalized = value.strip()
    if not normalized:
        return None

    if not PHONE_ALLOWED_PATTERN.fullmatch(normalized):
        raise ValueError(TELEPHONE_NUMBER_ERROR)

    digits_count = sum(char.isdigit() for char in normalized)
    if digits_count < 5 or digits_count > 15:
        raise ValueError(TELEPHONE_NUMBER_ERROR)

    if normalized.count("+") > 1 or ("+" in normalized and not normalized.startswith("+")):
        raise ValueError(TELEPHONE_NUMBER_ERROR)

    return normalized
