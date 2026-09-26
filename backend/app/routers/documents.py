import io
import json
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import db_session
from app.models.schemas import DetectPreviewResponse, DocumentDetail, DocumentOut, RegionOut
from app.services import document_pipeline, field_patterns, ocr_processor, yolo_detector

# Rate-limit OCR in the live preview loop the same way the reference desktop
# scripts do (OCR_NEW_PER_FRAME=4): only the top-N highest-confidence regions
# get OCR'd per tick, so a dense frame can't blow out request latency.
_LIVE_OCR_MAX_REGIONS = 4

router = APIRouter(prefix="/api/documents", tags=["documents"])


async def run_pipeline_and_store(document_id: int, file_path: str, file_type: str) -> None:
    with db_session() as conn:
        conn.execute("UPDATE documents SET status = 'processing' WHERE id = ?", (document_id,))

    try:
        result = await document_pipeline.process_document(file_path, file_type)
    except Exception as exc:  # noqa: BLE001 - failures are recorded on the row, not raised
        with db_session() as conn:
            conn.execute(
                "UPDATE documents SET status = 'failed', raw_text = ? WHERE id = ?",
                (f"Processing error: {exc}", document_id),
            )
        return

    with db_session() as conn:
        conn.execute(
            "UPDATE documents SET processed = 1, status = 'processed', raw_text = ?, "
            "structured_json = ?, confidence = ? WHERE id = ?",
            (
                result["raw_text"],
                json.dumps(result["structured_json"]),
                result["confidence"],
                document_id,
            ),
        )


def _row_to_out(row) -> DocumentOut:
    return DocumentOut(
        id=row["id"],
        filename=row["filename"],
        file_type=row["file_type"],
        upload_date=row["upload_date"],
        processed=bool(row["processed"]),
        status=row["status"],
        confidence=row["confidence"],
    )


@router.post("", response_model=DocumentDetail, status_code=201)
async def upload_document(file: UploadFile, background_tasks: BackgroundTasks) -> DocumentDetail:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.upload_dir / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    file_type = Path(file.filename).suffix.lstrip(".").lower() or "unknown"

    with db_session() as conn:
        cur = conn.execute(
            "INSERT INTO documents (filename, file_path, file_type, status) VALUES (?, ?, ?, ?)",
            (file.filename, str(dest), file_type, "pending"),
        )
        doc_id = cur.lastrowid
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()

    if file_type in ("pdf", "png", "jpg", "jpeg"):
        background_tasks.add_task(run_pipeline_and_store, doc_id, str(dest), file_type)

    return DocumentDetail(
        **_row_to_out(row).model_dump(),
        raw_text=row["raw_text"],
        structured_json=json.loads(row["structured_json"]) if row["structured_json"] else None,
    )


@router.get("", response_model=list[DocumentOut])
async def list_documents() -> list[DocumentOut]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM documents WHERE doc_type = 'document' ORDER BY id DESC").fetchall()
    return [_row_to_out(r) for r in rows]


def _detect_preview_sync(file_data: bytes, domain: str) -> DetectPreviewResponse:
    """Synchronous core of detect_preview - runs in a worker thread so YOLO + OCR
    on a single frame don't block the event loop for every other request."""
    from PIL import Image

    # Read the frame straight from memory. Writing to an open NamedTemporaryFile
    # and then Image.open()-ing the same path fails on Windows (the handle is
    # still locked), which made every live preview request 500 with
    # PermissionError. Only disk artifacts that must survive long enough for
    # YOLO/PaddleOCR are materialized, always delete=False + closed + unlinked.
    with Image.open(io.BytesIO(file_data)) as opened:
        img = opened.convert("RGB")
    width, height = img.size

    # Upscale small frames (webcams) to ~training imgsz so small objects
    # register - aspect preserved, boxes mapped back below. Detection runs with
    # a lower confidence floor than the capture pipeline because live frames are
    # noisier/lower-res; a box shown live just hints "aim here", the capture
    # path still enforces the strict 0.5 threshold.
    longest = max(width, height)
    scale = 1.0
    detection_img = img
    if longest < settings.yolo_preview_min_input_px:
        scale = settings.yolo_preview_min_input_px / longest
        detection_img = img.resize((round(width * scale), round(height * scale)), Image.LANCZOS)

    detection_path = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
        detection_img.save(tmp.name, "JPEG", quality=92)
        tmp.close()
        detection_path = tmp.name

        try:
            raw_regions = yolo_detector.detect_regions(
                detection_path,
                domain=domain,
                confidence_threshold=settings.yolo_preview_confidence,
            )
        except Exception as exc:  # noqa: BLE001 - a failed preview frame just yields no boxes
            print(f"detect-preview failed: {exc}")
            raw_regions = []
    finally:
        if detection_path:
            os.unlink(detection_path)

    if scale != 1.0:
        for r in raw_regions:
            r["box"] = [x / scale for x in r["box"]]

    ocr_budget = sorted(raw_regions, key=lambda r: r["confidence"], reverse=True)[:_LIVE_OCR_MAX_REGIONS]
    ocr_ids = {id(r) for r in ocr_budget}

    regions = []
    for r in raw_regions:
        text = None
        if id(r) in ocr_ids:
            x1, y1, x2, y2 = r["box"]
            crop = img.crop((max(0, x1), max(0, y1), min(width, x2), min(height, y2)))
            if crop.width >= 4 and crop.height >= 4:
                crop_path = None
                try:
                    crop_tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
                    crop.save(crop_tmp.name, "PNG")
                    crop_tmp.close()
                    crop_path = crop_tmp.name
                    crop_result = ocr_processor.extract_text(crop_path)
                    text = crop_result["full_text"].strip() or None
                finally:
                    if crop_path:
                        os.unlink(crop_path)
        regions.append(
            RegionOut(
                label=r["label"],
                confidence=r["confidence"],
                box=r["box"],
                text=text,
                pattern_match=field_patterns.check_pattern(domain, r["label"], text or ""),
            )
        )

    return DetectPreviewResponse(regions=regions, image_width=width, image_height=height)


@router.post("/detect-preview", response_model=DetectPreviewResponse)
async def detect_preview(file: UploadFile, domain: str = "exams") -> DetectPreviewResponse:
    """Live camera overlay: detection (+ light OCR) for a single frame, no DB write.

    `domain` ("exams" or "invoices") picks which fine-tuned model runs - this
    must match whichever page the camera is open on, or you'd be running the
    exam model's classes against an invoice (or vice versa).

    Only the top `_LIVE_OCR_MAX_REGIONS` boxes get OCR'd (same rate-limit the
    reference desktop scripts use), so a dense frame can't blow out latency -
    full per-region OCR for every box still only happens once, on capture.
    """
    return await run_in_threadpool(_detect_preview_sync, await file.read(), domain)


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: int) -> DocumentDetail:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentDetail(
        **_row_to_out(row).model_dump(),
        raw_text=row["raw_text"],
        structured_json=json.loads(row["structured_json"]) if row["structured_json"] else None,
    )


@router.get("/{document_id}/image")
async def get_document_image(document_id: int):
    """Serve the exact image detection/OCR ran against (PDFs get their rendered page, not the raw PDF)."""
    with db_session() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")

    image_path = Path(await run_in_threadpool(document_pipeline.render_to_image, row["file_path"], row["file_type"]))
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(image_path)


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: int) -> None:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Document not found")
        Path(row["file_path"]).unlink(missing_ok=True)
        conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))


@router.post("/summarize")
async def summarize_document():
    raise HTTPException(status_code=501, detail="Document summarization lands in Phase 3 (Ollama integration)")
