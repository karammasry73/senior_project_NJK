from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SME_", env_file=".env", extra="ignore")

    # Database
    db_path: Path = BACKEND_DIR / "data" / "sme_automation.db"

    # Ollama - qwen3.5:4b is a speed/quality balance for CPU-only inference;
    # also available on this machine: qwen3.5:2b (faster), qwen3.5:9b (better),
    # huihui_ai/dolphin3-abliterated:latest. Override via SME_OLLAMA_MODEL.
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen3.5:9b"
    ollama_timeout_seconds: float = 5.0

    # YOLO - two specialized models, chosen per-document by domain
    yolo_weights_path_exams: Path = BACKEND_DIR / "models" / "exams.pt"
    yolo_weights_path_invoices: Path = BACKEND_DIR / "models" / "invoices.pt"
    # Live camera preview: lower floor than the capture pipeline (0.5) because
    # webcam frames are noisier/lower-resolution; and upscale small frames to
    # ~training imgsz so small objects still register.
    yolo_preview_confidence: float = 0.25
    yolo_preview_min_input_px: int = 960

    # PaddleOCR
    paddleocr_lang: str = "en"

    # Uploads
    upload_dir: Path = BACKEND_DIR / "data" / "uploads"

    # CORS - Vite dev server
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Gmail (email management) - create these at console.cloud.google.com
    # (OAuth client, type "Web application"). Set via .env, never commit them.
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/emails/auth/callback"


settings = Settings()
