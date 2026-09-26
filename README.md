# SME Automation Assistant

AI-powered document processing and administrative automation for small and
medium enterprises: invoice/receipt data extraction (YOLO + PaddleOCR),
email categorization & drafting, and a voice assistant — built to run fully
offline against a local [Ollama](https://ollama.com) model.

See [`PLAN.md`](PLAN.md) for the project brief and [`PROJECT_REPORT.md`](PROJECT_REPORT.md)
for the full architecture/implementation writeup.

## Prerequisites

- **Python 3.12** (the OCR/YOLO stack doesn't yet have wheels for newer
  Python; see the note at the top of `backend/requirements.txt`).
- **Node.js** (for the Vite/React frontend).
- **[Ollama](https://ollama.com)** installed and running (`ollama serve`),
  with a model pulled — this project defaults to `qwen3.5:9b`:
  ```
  ollama pull qwen3.5:9b
  ```
  A smaller (`qwen3.5:2b`) or larger (`qwen3.5:9b`+) model works too; override
  via `SME_OLLAMA_MODEL` in `backend/.env` (see `backend/.env.example`).

## Setup

```bash
# Backend
cd backend
python3 -m venv .venv
# CPU-only torch first (skip if you have an NVIDIA GPU) - otherwise
# ultralytics pulls ~2GB of unused CUDA packages:
.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # optional: fill in Gmail OAuth creds, override the Ollama model

# Frontend
cd ../frontend
npm install
```

## Running

```bash
./run.sh      # Mac/Linux - starts backend (:8000) and frontend (:5173) together
run.ps1       # Windows equivalent
```

Backend API docs: http://127.0.0.1:8000/docs. Frontend: http://localhost:5173.

## What's not included

- `backend/.venv/`, `frontend/node_modules/` — reinstall via the setup steps above.
- `tools/` (make-sense.ai annotation tool) — only needed for re-annotating training data; clone separately if you need it.
- The YOLO training dataset (`backend/data/raw/`, `backend/data/datasets/*/images|labels`) and training run artifacts (`backend/runs/`) — training is done; the resulting weights (`backend/models/*.pt`) are included and are all the app needs at runtime.
- `backend/.env`, `backend/data/*.db`, `backend/data/uploads/` — local secrets and runtime/user data.
