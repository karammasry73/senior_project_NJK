"""Per-class OCR validation patterns, one set per domain.

Ported from the reference desktop scripts (exam_cam.py / invoice_cam.py):
each detected region's class can optionally be checked against a regex
that "text in this field should roughly look like" - a date, an amount,
an email, etc. Classes with no pattern are just left unvalidated (no
green/orange signal, only the OCR text itself).

Note the original exam_cam.py actually reused invoice_cam.py's PATTERNS
dict verbatim, so none of its keys (invoice number, Tax, Due_Date, ...)
matched any real exam class name - the exam script's pattern validation
was silently a no-op. Fixed here: exams gets its own dict keyed to its
actual classes (lu_logo, question, subject, date, faculty, duration,
semester, department, university_name, instructions).
"""

import re

CURRENCY = re.compile(r"\d[\d.,]*(?:\d{1,2})?")
DATE = re.compile(r"\d{1,4}[\s/.\\-]\d{1,2}[\s/.\\-]\d{1,4}")
PHONE = re.compile(r"\+?\d[\d\s\-()]{5,}")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.")
NUMERIC_ID = re.compile(r"\d[\d/-]{2,}")

PATTERNS_BY_DOMAIN: dict[str, dict[str, re.Pattern]] = {
    "invoices": {
        "invoice number": NUMERIC_ID,
        "invoice date": DATE,
        "Due_Date": DATE,
        "Tel_Client": PHONE,
        "Email_Client": EMAIL,
        "Subtotal": CURRENCY,
        "total": CURRENCY,
        "Tax": CURRENCY,
        "Remise": CURRENCY,
        "Discount_Percentage": CURRENCY,
        "Tax_Precentage": CURRENCY,
    },
    "exams": {
        "date": DATE,
    },
}


def check_pattern(domain: str, class_name: str, text: str) -> bool | None:
    """True on match, False on explicit mismatch, None when no pattern is
    defined for this class (or there's no text) - used to color the label."""
    if not text:
        return None
    pattern = PATTERNS_BY_DOMAIN.get(domain, {}).get(class_name)
    if pattern is None:
        return None
    return bool(pattern.search(text))
