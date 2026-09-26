"""PaddleOCR text + table extraction.

The PaddleOCR engine is heavy to initialize (loads detection + recognition
models), so it's created once per process and reused across requests.

PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False works around a PaddlePaddle 3.3.1
CPU inference bug (oneDNN's PIR executor raises
`NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support
[pir::ArrayAttribute<pir::DoubleAttribute>]` on the text detection model);
must be set before paddlex is imported anywhere in the process, hence the
module-level `os.environ.setdefault` below.
"""

import os
from functools import lru_cache

os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")

from app.config import settings
from app.models.schemas import ServiceStatus


async def check_status() -> ServiceStatus:
    try:
        import paddleocr  # noqa: F401
    except ImportError:
        return ServiceStatus(available=False, detail="paddleocr package not installed")

    return ServiceStatus(available=True, detail=f"paddleocr {paddleocr.__version__} importable")


@lru_cache(maxsize=1)
def _get_engine():
    from paddleocr import PaddleOCR

    return PaddleOCR(lang=settings.paddleocr_lang)


def extract_text(image_path: str) -> dict:
    """Run OCR over an image, returning recognized lines and a row-grouped table guess.

    Returns:
        {
          "lines": [{"text": str, "confidence": float, "box": [[x,y]*4]}, ...],
          "full_text": str,
          "table_rows": [[str, ...], ...]  # heuristic grouping by line y-position
        }
    """
    engine = _get_engine()
    result = engine.predict(image_path)
    page = result[0] if result else None

    lines = []
    if page is not None:
        texts = page.get("rec_texts", [])
        scores = page.get("rec_scores", [])
        polys = page.get("rec_polys", [])
        for text, score, poly in zip(texts, scores, polys):
            box = [[float(x), float(y)] for x, y in poly]
            lines.append({"text": text, "confidence": float(score), "box": box})

    full_text = "\n".join(line["text"] for line in lines)
    table_rows = _group_into_rows(lines)

    return {"lines": lines, "full_text": full_text, "table_rows": table_rows}


def _group_into_rows(lines: list[dict], y_tolerance: float = 12.0) -> list[list[str]]:
    """Group OCR lines into table-like rows by clustering on vertical position.

    This is an MVP stand-in for PaddleOCR's full PPStructure table recognizer
    (which pulls in extra heavy dependencies). It clusters text boxes whose
    top-left y-coordinate is within `y_tolerance` px of each other into the
    same row, then orders each row left-to-right by x-coordinate.
    """
    if not lines:
        return []

    def top_y(line: dict) -> float:
        return min(point[1] for point in line["box"])

    def left_x(line: dict) -> float:
        return min(point[0] for point in line["box"])

    sorted_lines = sorted(lines, key=top_y)
    rows: list[list[dict]] = []
    for line in sorted_lines:
        if rows and abs(top_y(line) - top_y(rows[-1][0])) <= y_tolerance:
            rows[-1].append(line)
        else:
            rows.append([line])

    return [[l["text"] for l in sorted(row, key=left_x)] for row in rows]
