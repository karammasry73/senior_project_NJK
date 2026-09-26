from fastapi import APIRouter

from app.models.schemas import SystemStatus
from app.services import ocr_processor, ollama_client, voice_handler, yolo_detector

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status", response_model=SystemStatus)
async def get_status() -> SystemStatus:
    yolo, paddleocr, ollama, voxtype = [
        await coro
        for coro in (
            yolo_detector.check_status(),
            ocr_processor.check_status(),
            ollama_client.check_status(),
            voice_handler.check_status(),
        )
    ]
    return SystemStatus(yolo=yolo, paddleocr=paddleocr, ollama=ollama, voxtype=voxtype)
