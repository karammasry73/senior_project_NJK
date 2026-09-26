"""Orchestrates YOLO detection -> PaddleOCR extraction -> field structuring.

Two specialized YOLO models are available (see yolo_detector.py): "exams"
and "invoices", each with their own class taxonomy. `domain` picks which
one runs and how the detected regions get turned into structured fields.

Ollama-based structuring (PLAN.md Phase 3) isn't wired in yet. For invoices
with a detected "invoice number"/"total"/etc region, fields come straight
from the per-region crop+OCR (see _extract_invoice_fields_from_regions) -
tied to a real detected box, not guessed. Whole-page regex
(_extract_fields_heuristic) is only a fallback for when no useful regions
were detected (e.g. stock/non-invoice-tuned weights).
"""

import re
import tempfile
from pathlib import Path

from starlette.concurrency import run_in_threadpool

from app.services import ocr_processor, yolo_detector

_DATE_RE = re.compile(r"\b(\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4})\b")
_TOTAL_LINE_RE = re.compile(r"total", re.IGNORECASE)
_AMOUNT_RE = re.compile(r"[\$€£]?\s?\d[\d,]*\.\d{2}")
_INVOICE_NO_RE = re.compile(r"(?:invoice|inv)\s*[#:no.]*\s*([A-Za-z0-9-]+)", re.IGNORECASE)
_CURRENCY_RE = re.compile(r"[\$€£]")

# invoices.pt class -> InvoiceOut field. Classes with no direct field
# (Products, Tax, Subtotal, addresses, client contact, etc.) still show up
# in structured_json.regions_text, just not forced into these fixed columns.
_INVOICE_FIELD_CLASSES = {
    "invoice number": "invoice_number",
    "invoice date": "date",
    "header": "vendor",
}


def render_to_image(file_path: str, file_type: str) -> str:
    """Return a path to a raster image for the given upload, rendering PDFs to PNG.

    Also used by the /documents/{id}/image endpoint to serve the exact image
    that detection/OCR ran against (not the raw PDF, which a browser can't
    render as an <img> anyway, and whose page coordinates wouldn't line up
    with the region boxes computed against the rendered page).
    """
    if file_type != "pdf":
        return file_path

    import pymupdf

    doc = pymupdf.open(file_path)
    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=200)
    out_path = str(Path(file_path).with_suffix(".page1.png"))
    pix.save(out_path)
    doc.close()
    return out_path


def _extract_fields_heuristic(full_text: str) -> dict:
    """Whole-page regex fallback - used when no useful regions were detected."""
    lines = [l.strip() for l in full_text.splitlines() if l.strip()]

    invoice_number = None
    if m := _INVOICE_NO_RE.search(full_text):
        invoice_number = m.group(1)

    date = None
    if m := _DATE_RE.search(full_text):
        date = m.group(1)

    total = None
    for line in lines:
        if _TOTAL_LINE_RE.search(line) and (m := _AMOUNT_RE.search(line)):
            total = m.group(0).lstrip("$€£ ").replace(",", "")
            break

    vendor = lines[0] if lines else None

    return {
        "invoice_number": invoice_number,
        "vendor": vendor,
        "date": date,
        "total": float(total) if total else None,
        "currency": None,
    }


def _extract_invoice_fields_from_regions(regions_text: dict[str, list[str]]) -> dict:
    """Map invoices.pt's detected regions straight to InvoiceOut fields.

    Each field comes from OCR run on the specific box YOLO found for it, so
    e.g. `invoice_number` is genuinely "the text inside the invoice-number
    box", not a regex guess over the whole page.
    """

    def first(label: str) -> str | None:
        vals = regions_text.get(label)
        return vals[0].strip() if vals else None

    fields = {"invoice_number": None, "vendor": None, "date": None, "total": None, "currency": None}
    for region_label, field_name in _INVOICE_FIELD_CLASSES.items():
        text = first(region_label)
        if text:
            fields[field_name] = text

    total_text = first("total")
    if total_text:
        if m := _AMOUNT_RE.search(total_text):
            fields["total"] = float(m.group(0).lstrip("$€£ ").replace(",", ""))
        else:
            fields["total"] = None
        if m := _CURRENCY_RE.search(total_text):
            fields["currency"] = m.group(0)

    return fields


def _crop_and_ocr_regions(image_path: str, regions: list[dict]) -> dict[str, list[str]]:
    """OCR each YOLO-detected region individually, keyed by class label.

    Ties extracted text directly to its semantic region (e.g. the text inside
    a "subject" box) instead of guessing from whole-page regex.
    """
    from PIL import Image

    img = Image.open(image_path).convert("RGB")
    texts: dict[str, list[str]] = {}

    with tempfile.TemporaryDirectory() as tmp_dir:
        for i, region in enumerate(regions):
            x1, y1, x2, y2 = region["box"]
            crop = img.crop((max(0, x1), max(0, y1), min(img.width, x2), min(img.height, y2)))
            if crop.width < 4 or crop.height < 4:
                continue
            crop_path = str(Path(tmp_dir) / f"region_{i}.png")
            crop.save(crop_path)
            crop_result = ocr_processor.extract_text(crop_path)
            if crop_result["full_text"]:
                texts.setdefault(region["label"], []).append(crop_result["full_text"])

    return texts


def _process_document_sync(file_path: str, file_type: str, domain: str) -> dict:
    """Synchronous core of process_document - runs in a worker thread (YOLO + OCR
    are CPU-bound and would otherwise block the asyncio event loop for the whole
    server, freezing /docs and every other request while a document processes)."""
    image_path = render_to_image(file_path, file_type)

    try:
        regions = yolo_detector.detect_regions(image_path, domain=domain)
    except Exception as exc:  # noqa: BLE001 - detection failures shouldn't block OCR
        regions = []
        regions_error = str(exc)
    else:
        regions_error = None

    ocr_result = ocr_processor.extract_text(image_path)
    regions_text = _crop_and_ocr_regions(image_path, regions) if regions else {}

    if domain == "invoices" and regions_text:
        fields = _extract_invoice_fields_from_regions(regions_text)
        extraction_method = "invoices.pt region detection + per-region OCR"
    else:
        fields = _extract_fields_heuristic(ocr_result["full_text"])
        extraction_method = "heuristic-regex fallback (no invoice regions detected)"

    confidences = [l["confidence"] for l in ocr_result["lines"]]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    structured = {
        "regions": regions,
        "regions_error": regions_error,
        "regions_text": regions_text,
        "table_rows": ocr_result["table_rows"],
        "fields": fields,
        "extraction_method": extraction_method,
    }

    return {
        "raw_text": ocr_result["full_text"],
        "structured_json": structured,
        "confidence": avg_confidence,
        "fields": fields,
    }


async def process_document(file_path: str, file_type: str, domain: str = "exams") -> dict:
    """Run the detect -> OCR -> structure pipeline for one uploaded document.

    `domain` selects which fine-tuned YOLO model runs ("exams" or "invoices")
    and, for invoices, how detected regions map to structured fields.

    Returns a dict matching the shape stored in Documents.structured_json,
    plus raw_text and a confidence estimate for the Documents row.
    """
    return await run_in_threadpool(_process_document_sync, file_path, file_type, domain)
