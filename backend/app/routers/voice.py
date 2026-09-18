from fastapi import APIRouter, HTTPException

from app.models.schemas import VoiceCommandRequest, VoiceCommandResponse

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/command", response_model=VoiceCommandResponse)
async def run_voice_command(body: VoiceCommandRequest) -> VoiceCommandResponse:
    raise HTTPException(status_code=501, detail="Voice command routing lands in Phase 4 (VoxType integration)")
