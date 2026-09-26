import shutil

from app.models.schemas import ServiceStatus


async def check_status() -> ServiceStatus:
    if shutil.which("voxtype"):
        return ServiceStatus(available=True, detail="voxtype CLI found on PATH")
    return ServiceStatus(available=False, detail="voxtype not installed")


def handle_command(command_text: str) -> dict:
    """Route a transcribed voice command to the relevant backend action. Implemented in Phase 4."""
    raise NotImplementedError("Voice command routing lands in Phase 4")
