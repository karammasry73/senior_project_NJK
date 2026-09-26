"""YOLOv8 layout/field detection for uploaded documents.

Two fine-tuned models are available, chosen by `domain`:
  - "exams": 10 classes (lu_logo, question, subject, date, faculty, duration,
    semester, department, university_name, instructions) - trained on 128
    labeled Lebanese University exam pages.
  - "invoices": 16 classes (invoice number, invoice date, total, Tax,
    Subtotal, Products, billing/shipping address, client contact, etc.)
Falls back to stock pretrained YOLOv8n (COCO classes) if the relevant
weights file isn't present, which won't recognize document-specific
regions but keeps the detect -> OCR pipeline from breaking.
"""

from functools import lru_cache

from app.config import settings
from app.models.schemas import ServiceStatus

_STOCK_WEIGHTS = "yolov8n.pt"

_WEIGHTS_BY_DOMAIN = {
    "exams": lambda: settings.yolo_weights_path_exams,
    "invoices": lambda: settings.yolo_weights_path_invoices,
}

# A Lebanese University exam page only ever has one of these fields - if the
# model reports two "lu_logo" boxes, the lower-confidence one is a mislabel,
# not a second logo. Cap each class to how many times it can legitimately
# appear, keeping only the highest-confidence box(es) up to the cap.
_MAX_LABELS_BY_DOMAIN: dict[str, dict[str, int]] = {
    "exams": {
        "lu_logo": 1,
        "duration": 1,
        "date": 2,
        "subject": 1,
    },
}


def _cap_duplicate_labels(regions: list[dict], domain: str) -> list[dict]:
    caps = _MAX_LABELS_BY_DOMAIN.get(domain)
    if not caps:
        return regions

    by_label: dict[str, list[dict]] = {}
    for region in regions:
        by_label.setdefault(region["label"], []).append(region)

    kept: list[dict] = []
    for label, group in by_label.items():
        limit = caps.get(label)
        if limit is None:
            kept.extend(group)
            continue
        group.sort(key=lambda r: r["confidence"], reverse=True)
        kept.extend(group[:limit])

    kept.sort(key=lambda r: r["confidence"], reverse=True)
    return kept


def _resolve_weights(domain: str) -> str:
    getter = _WEIGHTS_BY_DOMAIN.get(domain)
    path = getter() if getter else None
    return str(path) if path and path.exists() else _STOCK_WEIGHTS


async def check_status() -> ServiceStatus:
    try:
        import ultralytics
    except ImportError:
        return ServiceStatus(available=False, detail="ultralytics package not installed")

    loaded = [name for name, getter in _WEIGHTS_BY_DOMAIN.items() if getter().exists()]
    missing = [name for name in _WEIGHTS_BY_DOMAIN if name not in loaded]

    if loaded and not missing:
        return ServiceStatus(available=True, detail=f"custom weights loaded: {', '.join(loaded)}")
    if loaded:
        return ServiceStatus(
            available=True,
            detail=f"custom weights loaded: {', '.join(loaded)}; missing for: {', '.join(missing)} (falls back to stock)",
        )
    return ServiceStatus(
        available=True,
        detail=f"ultralytics {ultralytics.__version__} ready; no custom weights yet, falling back to stock {_STOCK_WEIGHTS}",
    )


@lru_cache(maxsize=4)
def _get_model(weights: str):
    from ultralytics import YOLO

    return YOLO(weights)


def detect_regions(image_path: str, domain: str = "exams", confidence_threshold: float = 0.5) -> list[dict]:
    """Detect layout regions in a document image using the model for `domain`.

    confidence_threshold defaults to 0.5 (at least 50% confidence) for both
    domains - anything below that is dropped as too unreliable to trust.

    Returns a list of {"label": str, "confidence": float, "box": [x1, y1, x2, y2]}.
    """
    model = _get_model(_resolve_weights(domain))
    results = model.predict(image_path, conf=confidence_threshold, verbose=False)

    regions = []
    for result in results:
        names = result.names
        for box in result.boxes:
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            regions.append(
                {
                    "label": names[int(box.cls[0])],
                    "confidence": float(box.conf[0]),
                    "box": [x1, y1, x2, y2],
                }
            )
    return _cap_duplicate_labels(regions, domain)
