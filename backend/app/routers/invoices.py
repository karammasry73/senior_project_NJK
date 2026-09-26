import json
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings
from app.database import db_session
from app.models.schemas import InvoiceFlagRequest, InvoiceOut
from app.services import document_pipeline

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


def _row_to_out(row) -> InvoiceOut:
    return InvoiceOut(
        id=row["id"],
        document_id=row["document_id"],
        invoice_number=row["invoice_number"],
        vendor=row["vendor"],
        date=row["date"],
        total=row["total"],
        currency=row["currency"],
        items=json.loads(row["items_json"]) if row["items_json"] else [],
        confidence_score=row["confidence_score"],
        needs_review=bool(row["needs_review"]),
    )


@router.post("/process", response_model=InvoiceOut, status_code=201)
async def process_invoice(file: UploadFile) -> InvoiceOut:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.upload_dir / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    file_type = Path(file.filename).suffix.lstrip(".").lower() or "unknown"
    if file_type not in ("pdf", "png", "jpg", "jpeg"):
        raise HTTPException(status_code=422, detail=f"Unsupported file type: {file_type}")

    with db_session() as conn:
        cur = conn.execute(
            "INSERT INTO documents (filename, file_path, file_type, doc_type, status) VALUES (?, ?, ?, 'invoice', ?)",
            (file.filename, str(dest), file_type, "processing"),
        )
        document_id = cur.lastrowid

    try:
        result = await document_pipeline.process_document(str(dest), file_type, domain="invoices")
    except Exception as exc:  # noqa: BLE001 - surfaced as a 500 with the underlying cause
        with db_session() as conn:
            conn.execute("UPDATE documents SET status = 'failed' WHERE id = ?", (document_id,))
        raise HTTPException(status_code=500, detail=f"Invoice processing failed: {exc}") from exc

    fields = result["fields"]

    with db_session() as conn:
        conn.execute(
            "UPDATE documents SET processed = 1, status = 'processed', raw_text = ?, "
            "structured_json = ?, confidence = ? WHERE id = ?",
            (result["raw_text"], json.dumps(result["structured_json"]), result["confidence"], document_id),
        )
        cur = conn.execute(
            "INSERT INTO invoices (document_id, invoice_number, vendor, date, total, currency, "
            "items_json, confidence_score, needs_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
            (
                document_id,
                fields["invoice_number"],
                fields["vendor"],
                fields["date"],
                fields["total"],
                fields["currency"],
                json.dumps(result["structured_json"]["table_rows"]),
                result["confidence"],
            ),
        )
        invoice_id = cur.lastrowid
        row = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()

    return _row_to_out(row)


@router.get("", response_model=list[InvoiceOut])
async def list_invoices() -> list[InvoiceOut]:
    with db_session() as conn:
        rows = conn.execute("SELECT * FROM invoices ORDER BY id DESC").fetchall()
    return [_row_to_out(r) for r in rows]


@router.post("/{invoice_id}/flag")
async def flag_invoice_field(invoice_id: int, body: InvoiceFlagRequest) -> InvoiceOut:
    with db_session() as conn:
        row = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Invoice not found")
        conn.execute(
            "UPDATE invoices SET needs_review = ? WHERE id = ?",
            (0 if body.confirmed else 1, invoice_id),
        )
        row = conn.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone()
    return _row_to_out(row)
