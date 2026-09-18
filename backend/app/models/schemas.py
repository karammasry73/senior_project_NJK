from typing import Any

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    upload_date: str
    processed: bool
    status: str
    confidence: float | None = None


class DocumentDetail(DocumentOut):
    raw_text: str | None = None
    structured_json: dict[str, Any] | None = None


class RegionOut(BaseModel):
    label: str
    confidence: float
    box: list[float]  # [x1, y1, x2, y2] in source-image pixel space
    text: str | None = None  # live-preview only: OCR'd text for this region
    pattern_match: bool | None = None  # True/False if the domain defines a pattern for this class, else None


class DetectPreviewResponse(BaseModel):
    regions: list[RegionOut]
    image_width: int
    image_height: int


class InvoiceOut(BaseModel):
    id: int
    document_id: int
    invoice_number: str | None = None
    vendor: str | None = None
    date: str | None = None
    total: float | None = None
    currency: str | None = None
    items: list[list[str]] = []  # OCR table rows (heuristic); real line-item parsing lands in Phase 3
    confidence_score: float | None = None
    needs_review: bool = False


class InvoiceFlagRequest(BaseModel):
    field: str
    confirmed: bool


class EmailOut(BaseModel):
    id: int
    subject: str | None = None
    sender: str | None = None
    recipient: str | None = None
    received_date: str | None = None
    category: str | None = None
    summary: str | None = None
    drafted_reply: str | None = None
    sent: bool = False
    processed_date: str


class EmailDetail(EmailOut):
    body: str | None = None
    thread_id: str | None = None


class EmailAuthStatus(BaseModel):
    configured: bool
    connected: bool


class EmailAuthUrl(BaseModel):
    url: str


class SendReplyRequest(BaseModel):
    body: str


class DocumentSummarizeRequest(BaseModel):
    document_id: int


class DocumentSummarizeResponse(BaseModel):
    summary: str


class VoiceCommandRequest(BaseModel):
    command_text: str


class VoiceCommandResponse(BaseModel):
    action_taken: str
    result: dict[str, Any] | None = None


class ServiceStatus(BaseModel):
    available: bool
    detail: str


class SystemStatus(BaseModel):
    yolo: ServiceStatus
    paddleocr: ServiceStatus
    ollama: ServiceStatus
    voxtype: ServiceStatus


class SettingOut(BaseModel):
    key: str
    value: str | None = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdateRequest(BaseModel):
    role: str | None = None
    password: str | None = None
