# SME Automation — AI Business Process Assistant

## Comprehensive Project Report

**Version:** 1.0 · **Date:** September 21, 2026
**Repository root:** `K:\Downloads\sme-automation`
**Scope:** Full-stack document, invoice, and email automation system with a voice/AI assistant, a local LLM (Ollama), custom-trained YOLO layout detection, and OCR.

---

## Table of Contents

1. Executive Summary
2. Project Goals
3. Architecture Overview
4. Technology Stack
5. Repository Layout
6. Backend System (Python / FastAPI)
   - 6.1 Configuration
   - 6.2 Database Schema (SQLite)
   - 6.3 Database Migrations & Bootstrap
   - 6.4 Application Setup
   - 6.5 API Endpoints (Full Reference)
   - 6.6 Services
   - 6.7 Document Processing Pipeline
   - 6.8 Email AI (Ollama profiles)
   - 6.9 Gmail Integration (OAuth2)
   - 6.10 Auth & User Management
   - 6.11 Utility Scripts
   - 6.12 Dependencies (requirements.txt)
   - 6.13 Environment Variables
7. Custom YOLO Model Training
   - 7.1 Dataset
   - 7.2 Training Configuration
   - 7.3 Results & Metrics
8. Frontend System (React / Vite / Tailwind)
   - 8.1 Build Tooling
   - 8.2 Routing & Auth Guard
   - 8.3 API Client
   - 8.4 Global State & Polling
   - 8.5 Components (Page-by-Page)
9. AI Assistant (Voice) Features
10. Email Manager (List + Board/Map)
11. Integration Verification & Runtime Facts
12. Current Status, Known Gaps & Notes
13. Dev Tooling & How to Run
14. Future Work
15. Appendix A — Schema DDL
16. Appendix B — Endpoint Summary Table

---

## 1. Executive Summary

The **SME Automation** project is a self-hosted, local-first application that automates the daily administrative workflows of a small/medium enterprise (SME) around three core artifacts:

- **Documents** — scan or upload exam-style papers and other documents with a live camera preview; automatically detect layout regions via a custom-trained YOLO model, run OCR, and extract structured fields.
- **Invoices** — process supplier invoices the same way (dedicated YOLO domain model), extract invoice number, vendor, date, total, tax, and line items, and flag results for human review.
- **Emails** — connect a Gmail account over OAuth2, sync the inbox into a local SQLite database, AI-categorize, summarize, and draft replies using a **local** LLM (Ollama), and explore the inbox as a spatial 2D "map" with threads drawn as git-style branches.

A cross-cutting **AI Assistant** (voice + text) accepts natural-language commands ("check system status", "invoice status", "unread emails", "categorize emails", free-form questions) and answers them from live database counts, with speech-to-text in the browser and optional text-to-speech.

The system is **fully local**: everything except Gmail OAuth runs on a single machine — local PaddleOCR, a CPU-trained custom YOLOv8n model, and a local Ollama LLM (qwen3.5:9b on an NVIDIA RTX 4050, 6 GB). No cloud AI is used. A session-token auth layer with roles guards every feature.

---

## 2. Project Goals

1. Replace manual re-keying of documents and invoices with camera- or file-based capture plus automatic layout detection, OCR, and field extraction.
2. Provide a visual, confidence-based review workflow (region overlays on the source image, needs-review flags) so extraction errors are caught and corrected.
3. Give an SME employee an inbox that is triaged by a local AI into actionable categories, summarized, and pre-drafted for reply.
4. Provide a live dashboard and a voice/chat assistant so the tool can be operated hands-free.
5. Run 100% locally (privacy-first), with Gmail being the only external dependency.

---

## 3. Architecture Overview

```
Browser (React SPA, Vite dev server)              :5173
        │  REST /api (JSON) via vite proxy ────────→  http://localhost:8000
        ▼
FastAPI application (uvicorn)                     :8000
  ├── Routers: auth, users, settings, system, documents, invoices,
  │            emails, emails OAuth callback, voice
  ├── Services:
  │     yolo_detector      — Ultralytics YOLO domain detection (exams.pt / invoices.pt)
  │     ocr_processor      — PaddleOCR (CPU, MKLDNN workaround)
  │     document_pipeline  — render -> detect -> OCR -> structure (threadpool)
  │     ollama_client      — local LLM generation (qwen3.5:9b)
  │     email_ai           — classify / summarize / draft (Ollama profiles)
  │     gmail_client       — Gmail OAuth2 + API (tokens stored in DB)
  │     voice_handler      — phase-4 speech stub
  │     field_patterns     — per-class OCR validation regexes
  │     auth / passwords   — session tokens + bcrypt
  └── Storage:
        data/sme_automation.db  — SQLite (documents, invoices, emails, users, ...)
        data/uploads/           — uploaded files
        models/exams.pt, invoices.pt, yolov8n.pt
```

Auth flow: `POST /api/auth/login` → opaque session token (SQLite-backed, 7-day TTL) → sent as `Authorization: Bearer <token>`; a `?token=` query-param fallback exists so `<img>` preview URLs can authenticate without headers.

---

## 4. Technology Stack

| Layer | Technology | Version / notes |
|---|---|---|
| Backend | Python | 3.12 (`uv` venv; Python ≤3.13 required — no PaddlePaddle 3.14 wheels) |
| Backend framework | FastAPI + Uvicorn | fastapi ≥0.115, uvicorn[standard] ≥0.32 (run without `--reload`) |
| Validation | Pydantic + pydantic-settings | ≥2.9 / ≥2.6, env prefix `SME_` |
| Database | SQLite (stdlib `sqlite3`) | schema + migrations in `database.py` |
| Object detection | Ultralytics YOLO | ≥8.4 (installed 8.4.156); fine-tuned from `yolov8n.pt` |
| OCR | PaddleOCR + PaddlePaddle | ≥3.7 / ≥3.3 (CPU; MKLDNN disabled) |
| PDF rendering | PyMuPDF (`pymupdf`) | ≥1.24; page-1 render @ 200 DPI |
| Images | Pillow ≥10.4, opencv-python-headless ≥4.10, NumPy ≥1.26,<2.3 | |
| LLM / AI | Ollama (local) | default model `qwen3.5:9b` on NVIDIA RTX 4050 (6 GB) |
| Gmail | google-api-python-client, google-auth-httplib2, google-auth-oauthlib | OAuth2 web flow + offline refresh |
| Passwords | bcrypt | ≥4.2 (standalone module, no circular imports) |
| HTTP | httpx ≥0.27 (Ollama), python-multipart (uploads) | |
| Frontend | React + Vite | React 19.2.8, Vite 8.3, `@vitejs/plugin-react` (Oxc) |
| Styling | Tailwind CSS v4 | `@import "tailwindcss"`, class-based dark mode |
| Routing | react-router-dom | 7.18.3 |
| Icons | lucide-react | 1.45.0 |
| Charts | recharts 3.10.1 declared but **unused** — Dashboard uses hand-rolled divs | |
| Linting | oxlint | `react` + `oxc` plugins |

---

## 5. Repository Layout

```
sme-automation/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app, CORS, router inclusion
│   │   ├── config.py                   # Settings (SME_* env vars)
│   │   ├── database.py                 # SCHEMA + migrations + bootstrap seed
│   │   ├── models/schemas.py           # Pydantic schemas
│   │   ├── routers/                    # auth, users, settings, system,
│   │   │                               #   documents, invoices, emails,
│   │   │                               #   emails_oauth_callback, voice
│   │   └── services/                   # yolo_detector, ocr_processor,
│   │                                   #   document_pipeline, ollama_client,
│   │                                   #   email_ai, gmail_client,
│   │                                   #   voice_handler, field_patterns,
│   │                                   #   auth, passwords
│   ├── scripts/                        # train_yolo, split_dataset,
│   │                                   #   voc_to_yolo, pdf_to_images
│   ├── data/
│   │   ├── sme_automation.db
│   │   ├── uploads/
│   │   ├── raw/exams/ (+ exams_labels/)
│   │   └── datasets/exams/             # data.yaml + images|labels split
│   ├── models/                         # exams.pt, invoices.pt, yolov8n.pt
│   ├── runs/detect/train/              # YOLO training artifacts
│   ├── requirements.txt
│   └── .env                            # SME_* secrets (gitignored)
├── frontend/
│   ├── index.html, package.json, vite.config.js
│   └── src/
│       ├── main.jsx, index.css, App.jsx
│       ├── services/api.js
│       └── components/                 # layout, dashboard, documents,
│                                       #   invoices, emails, voice,
│                                       #   settings, users, auth
├── PLAN.md                             # original (stale) roadmap — see §12
├── run.ps1, start-servers.ps1          # Windows dev tooling
└── PROJECT_REPORT.md                   # this document
```

---

## 6. Backend System (Python / FastAPI)

### 6.1 Configuration — `backend/app/config.py`

Pydantic `BaseSettings` with `env_prefix="SME_"`, `env_file=".env"`, `extra="ignore"`. A singleton `settings = Settings()` is used app-wide.

| Field | Type | Default |
|---|---|---|
| `db_path` | Path | `backend/data/sme_automation.db` |
| `ollama_host` | str | `http://localhost:11434` |
| `ollama_model` | str | `qwen3.5:9b` (comment lists alternatives: `qwen3.5:2b`, `huihui_ai/dolphin3-abliterated:latest`) |
| `ollama_timeout_seconds` | float | 5.0 (status probe only; generation uses a hardcoded 120 s) |
| `yolo_weights_path_exams` | Path | `backend/models/exams.pt` |
| `yolo_weights_path_invoices` | Path | `backend/models/invoices.pt` |
| `paddleocr_lang` | str | `en` |
| `upload_dir` | Path | `backend/data/uploads` |
| `cors_origins` | list[str] | `http://localhost:5173`, `http://127.0.0.1:5173` |
| `google_client_id` | str | `""` (secret) |
| `google_client_secret` | str | `""` (secret) |
| `google_redirect_uri` | str | `http://localhost:8000/api/emails/auth/callback` |

### 6.2 Database Schema (SQLite) — `backend/app/database.py`

Tables: `documents`, `invoices`, `emails`, `attachments`, `sender_names`, `summaries`, `voice_commands`, `settings`, `users`, `sessions`. Full DDL is in Appendix A.

Key design decisions:

- **`documents.doc_type`** distinguishes a normal *Documents page row* (`'document'`) from the *backing row for an invoice* (`'invoice'`). `GET /api/documents` returns only `doc_type='document'` rows; invoice processing (`/api/invoices/process`) writes a document row tagged `'invoice'` plus an `invoices` row referencing it. This cleanly separates the two pages while reusing one storage table (and the document-image preview endpoint).
- **`emails`** carry an AI `category` (urgent / action / follow_up / informational / spam), `gmail_category` (primary / social / promotions / updates / spam), board coordinates `pos_x`/`pos_y` for the map view, read state, direction `in`/`out`, and `thread_id` (so replies and originals link visually).
- **`sender_names`** maps a bare sender address → custom display name; once renamed, all emails from that address show the custom name.
- **`settings`** is a generic key/value store reused for Gmail OAuth token storage.
- Auth uses **opaque session tokens** stored in SQLite (no JWT), 7-day TTL.

### 6.3 Database Migrations & Bootstrap

`init_db()` is idempotent and applies, in order:

1. Full `SCHEMA` (`CREATE TABLE IF NOT EXISTS`).
2. `gmail_message_id` column check — if missing, `DROP TABLE emails` and re-run SCHEMA.
3. `sessions.expires_at` type correction TEXT → INTEGER (drop + recreate if wrong).
4. `emails.direction` added via `ALTER TABLE ... DEFAULT 'in'`.
5. `documents.doc_type` added via `ALTER TABLE ... DEFAULT 'document'`.
6. `emails.is_read`, `pos_x`, `pos_y`, `gmail_category` added conditionally.
7. **RFC-2822 → ISO-8601 UTC backfill** for `emails.received_date` (parses `%,%`-style dates).
8. **Bootstrap admin**: if `users` is empty → create `karam` / `12345` (bcrypt-hashed) / role `admin`. Code comment: *"Change this password after first login."*

### 6.4 Application Setup — `backend/app/main.py`

- Lifespan: `init_db()` on startup. No static mounts; upload folders are created lazily in the routers.
- `FastAPI(title="SME Automation Assistant API", version="0.1.0")`.
- CORS: allow origins = `settings.cors_origins`, credentials allowed, all methods/headers.
- Router inclusion with auth: documents, invoices, emails, voice, settings attach `Depends(get_current_user)` at the router level; **users** self-gates with `require_admin`; auth, the OAuth callback, and system health are public.
- `GET /` → `{"name": "SME Automation Assistant API", "docs": "/docs"}`.

### 6.5 API Endpoints (Full Reference)

**Auth (`/api/auth`, public)**

| Method | Path | Notes |
|---|---|---|
| POST | `/login` | body `{username, password}` → `{token, user}`; 401 on failure |
| POST | `/logout` | revokes session (Bearer) → 204 |
| GET | `/me` | current user from token → `{id, username, role, created_at}` |

**Users (`/api/users`, admin only)**

| Method | Path | Notes |
|---|---|---|
| GET | `/` | list all users |
| POST | `/` | create user; role must be admin/user (422), password ≥4 chars (422), unique username (409) → 201 |
| PATCH | `/{user_id}` | update role/password; cannot demote self, cannot remove last admin (400) |
| DELETE | `/{user_id}` | cannot delete self or last admin (400) → 204 |

**Settings (`/api/settings`, authed)** — `GET /` lists all rows; `PUT /` bulk-upserts (`INSERT ... ON CONFLICT(key) DO UPDATE`).

**System (`/api/system`, public)** — `GET /status` concurrently probes YOLO, PaddleOCR, Ollama, VoxType → `{yolo, paddleocr, ollama, voxtype: {available, detail}}`.

**Documents (`/api/documents`, authed)**

| Method | Path | Notes |
|---|---|---|
| POST | `/` | multipart upload; saves to upload_dir; pdf/png/jpg/jpeg trigger background `run_pipeline_and_store` (status pending → processing → processed/failed) → 201 |
| GET | `/` | list where `doc_type='document'`, ordered id desc |
| POST | `/detect-preview` | live camera overlay: YOLO detect + light OCR on top-4 regions (no DB write); query `domain` (`exams`\|`invoices`) |
| GET | `/{document_id}` | detail incl. `raw_text`, `structured_json`; 404 if absent |
| GET | `/{document_id}/image` | exact raster the model ran on (PDF page 0 @200 DPI); auth via header or `?token=` |
| DELETE | `/{document_id}` | unlinks file + deletes row → 204 |
| POST | `/summarize` | **stubbed → 501** (Phase-3 placeholder) |

**Invoices (`/api/invoices`, authed)**

| Method | Path | Notes |
|---|---|---|
| POST | `/process` | upload → documents row `doc_type='invoice'` → synchronous pipeline, `domain="invoices"` → invoices row `needs_review=1`, `items_json` = structured `table_rows`; failure → 500 + status 'failed' → 201 |
| GET | `/` | list invoices, ordered id desc |
| POST | `/{invoice_id}/flag` | body `{field, confirmed}` toggles `needs_review` (UI sends field literal `'all'`) |

`InvoiceOut` = `{id, document_id, invoice_number, vendor, date, total, currency, items: list[list[str]], confidence_score, needs_review}` — `items` rows come from OCR table-row grouping.

**Emails (`/api/emails`, authed except the OAuth callback)**

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/status` | `{configured, connected}` |
| GET | `/auth/url` | OAuth start URL; 400 if not configured |
| POST | `/sync` | query `max_results=20, after, before` (unix secs). Upserts, deletes+reinserts attachments, rebrands outgoing rows; 400 "Gmail is not connected yet" / 502 on error |
| GET | `/account` | connected account email (cached in settings) |
| GET | `/` | list all emails, id desc |
| GET | `/{email_id}` | detail incl. `body`; 404 |
| POST | `/{email_id}/classify` | Ollama classify → `category`; 502 on failure |
| POST | `/{email_id}/summarize` | Ollama summarize → `summary`; 502 |
| POST | `/{email_id}/draft` | Ollama draft reply (query `instructions`) → `drafted_reply`; 502 |
| POST | `/{email_id}/send` | body `{body}`; sends via Gmail, sets `sent`, inserts `direction='out'` thread row; 502 on failure |
| POST | `/{email_id}/mark` | body `{read}`; Gmail UNREAD toggle + DB update |
| POST | `/{email_id}/position` | body `{x,y}` board coordinates |
| POST | `/{email_id}/name-sender` | body `{name}` upserts `sender_names` |
| DELETE | `/{email_id}` | trash in Gmail + delete row → 204 |
| POST | `/restore` | undo-delete from in-memory copy; 409 if not found |
| GET | `/{email_id}/attachments/{att_id}` | bytes from Gmail, original mime + `Content-Disposition: attachment` |

**Emails OAuth callback (`GET /api/emails/auth/callback`, public)** — Google redirect target; handles `code`/`error` query params, exchanges the PKCE code, redirects the browser to `http://localhost:5173/emails?gmail_connected=1` (or `?gmail_error=...`). Kept in its own router because Google's browser redirect cannot carry an `Authorization` header.

**Voice (`/api/voice`, authed)**

- `POST /command` body `{command_text}` → `{action_taken, result}`; **never raises 500**.
- Intent routing order: help → greeting → smalltalk → "classify/categorize/sort" → "invoice" → "status/system/health/overview/dashboard" → "email/mail/unread" → "document/paper/file" → **_ai_fallback** (grounded Ollama answer built from live DB counts; temperature 0.4, max_tokens 250, graceful offline message).

### 6.6 Services — `backend/app/services/`

- **`yolo_detector.py`** — two fine-tuned models by `domain` (`exams`: 10 classes; `invoices`: 16 classes); stock `yolov8n.pt` fallback if weights are missing. `_MAX_LABELS_BY_DOMAIN` caps duplicate labels (exams: `lu_logo:1, duration:1, date:2, subject:1`), keeping the highest-confidence boxes. Model loading is `@lru_cache`d. Public API: `detect_regions(image_path, domain="exams", confidence_threshold=0.5)` → `[{label, confidence, box: [x1,y1,x2,y2]}]`. `check_status()` probes that weights exist.
- **`ocr_processor.py`** — PaddleOCR (CPU). Sets `PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False` as a workaround for a PaddlePaddle 3.3.1 CPU bug. `extract_text(image_path)` → `{lines: [{text, confidence, box}], full_text, table_rows}`. `_group_into_rows` clusters lines whose top-left y differs by ≤12 px into rows and sorts each row left-to-right (this produces the invoice line-item table).
- **`ollama_client.py`** — `generate(prompt, system=None, json_mode=False, temperature=0.2, max_tokens=600)` calls `POST {host}/api/generate` with `{"model": settings.ollama_model, "prompt", "stream": False, "think": False, "options": {"temperature", "top_p": 0.9, "num_predict": max_tokens}}`; `"format":"json"` when json_mode; hardcoded 120 s timeout for cold CPU loads. **`think=False` is critical**: qwen3.5 chain-of-thought cost 3000+ tokens / 7+ minutes when on; with it off, replies take ~1.5 s.
- **`email_ai.py`** — the per-task Ollama prompt profiles (see §6.8).
- **`gmail_client.py`** — OAuth2 web flow with PKCE; tokens persisted in the `settings` table (`gmail_oauth_token` JSON, single-use `gmail_oauth_code_verifier`, cached `gmail_account_email`); scopes `gmail.readonly + gmail.send + gmail.modify`; refresh failures degrade to "not connected" (forces re-connect after a scope is added). Message fetch supports `after`/`before` unix filters, INBOX label, `internalDate` → ISO-8601 UTC, `UNREAD` label → `is_read`, and Gmail category label mapping. `send_reply` builds a MIMEText body, prefixes `Re: ` if needed, and sends on the original `threadId`.
- **`voice_handler.py`** — Phase-4 stub: `check_status()` probes for a `voxtype` binary on PATH; `handle_command()` raises `NotImplementedError`.
- **`field_patterns.py`** — per-class validation regexes (`CURRENCY`, `DATE`, `PHONE`, `EMAIL`, `NUMERIC_ID`) keyed by domain + class name; `check_pattern(domain, class_name, text)` returns True (match) / False (mismatch) / None (no pattern defined or empty text). This fixes a bug in the original reference scripts where `exam_cam.py` reused invoice patterns, silently disabling exam validation.
- **`auth.py`** — `SESSION_TTL_SECONDS = 7*24*60*60`; opaque `secrets.token_urlsafe(32)` tokens; `get_current_user` accepts a Bearer header **or** `?token=` query (so `<img src>` previews work); `require_admin` → 403.
- **`passwords.py`** — standalone `hash_password` / `verify_password` (bcrypt), deliberately separate to avoid an auth ↔ database circular import.

### 6.7 Document Processing Pipeline — `document_pipeline.py`

`process_document(file_path, file_type, domain="exams")` (threadpool-wrapped so OCR doesn't block the event loop):

1. **Render** — non-PDF returns the path unchanged; PDFs have page 0 rendered to `{file}.page1.png` at **200 DPI** via PyMuPDF (matching the exact pixels detections and previews use).
2. **Detect** — `yolo_detector.detect_regions(...)`; a per-region OCR error is captured separately (region-level failures never kill the whole document).
3. **Whole-page OCR** — `ocr_processor.extract_text` → `full_text` + `table_rows`.
4. **Per-region OCR** — PIL-crop each detection box (min 4×4 px) to temp PNGs, OCR each, group text by class label → `regions_text`.
5. **Field extraction** — if `domain=="invoices"` and region text exists, map region texts to invoice fields (`invoice number`→invoice_number, `invoice date`→date, `header`→vendor; total parsed via an amount regex, currency via `$€£`); otherwise fall back to whole-page regex heuristics (`_DATE_RE`, `_TOTAL_LINE_RE`, `_AMOUNT_RE`, `_INVOICE_NO_RE`, `_CURRENCY_RE`; vendor = first non-empty line).
6. **Confidence** — mean of OCR line confidences.
7. Returns `{raw_text, structured_json: {regions, regions_error, regions_text, table_rows, fields, extraction_method}, confidence, fields}` which is persisted on the document row.

### 6.8 Email AI — Ollama per-task profiles (`email_ai.py`)

| Task | System prompt (gist) | temperature | max_tokens | json_mode |
|---|---|---|---|---|
| Classify | "email triage assistant … choose exactly one: urgent, action, follow_up, informational, spam. Respond with JSON only: `{"category": "<category>"}`" | 0.0 | 64 | true |
| Summarize | "Summarize the following email in 2–4 concise bullet points … no preamble" | 0.2 | 400 | false |
| Draft reply | "drafting a professional email reply … no subject line / no placeholder [Your Name] … only the reply body" | 0.4 | 600 | false |

Category aliases normalize `follow up`/`follow-up`/`followup` → `follow_up` and `info` → `informational`; classify defaults to `informational` on a parse failure. A single model (`qwen3.5:9b`) serves all tasks through different sampling profiles (the voice AI fallback uses temperature 0.4 / max_tokens 250).

### 6.9 Gmail Integration (OAuth2)

- Requires `SME_GOOGLE_CLIENT_ID` / `SME_GOOGLE_CLIENT_SECRET`; the redirect URI must be registered in Google Cloud Console as `http://localhost:8000/api/emails/auth/callback`.
- Flow: `GET /auth/url` builds a Google `Flow` (`access_type="offline"`, `prompt="consent"`), **persists the PKCE `code_verifier`** in the settings table → browser redirects to Google → the callback exchanges the code (reusing the persisted verifier) and deletes it → token JSON is saved to `settings` → browser is redirected back to `/emails?gmail_connected=1`.
- Scope note: the code comment warns that tokens minted *before* `gmail.modify` was added must be re-connected (a `RefreshError` is treated as "never connected").

### 6.10 Auth & User Management

- Roles: `admin` / `user` (SQL `CHECK`). Admin-only surfaces: the `/api/users` router and the frontend `/users` page. Guard rails prevent self-demotion, self-delete, and removing the last admin.
- Sessions live 7 days; logout deletes the token row; any 401 on the frontend triggers an automatic return to Login via the `sme:unauthorized` window event.

### 6.11 Utility Scripts — `backend/scripts/`

| Script | Purpose | CLI arguments |
|---|---|---|
| `train_yolo.py` | fine-tune YOLOv8 on the exam dataset (errors if `split_dataset.py` hasn't run) | `--model` (yolov8n.pt), `--epochs` (100), `--imgsz` (960 — "document fields are small" vs COCO's 640), `--batch` (4 — "~20 train images"), `--patience` (20). Best weights → `runs/detect/train/weights/best.pt` |
| `split_dataset.py` | split flat image+txt pairs into train/val/test (copies matching pairs) | `--images` (req), `--labels` (req), `--out` (req), `--ratios` (0.7 0.15 0.15), `--seed` (42); skips unlabeled images |
| `voc_to_yolo.py` | Pascal VOC XML → YOLO `.txt` (makesense.ai export); class indices from data.yaml | positional `voc_dir`, `out_dir`, `--classes` (data.yaml path) |
| `pdf_to_images.py` | batch-render PDFs → PNGs @200 DPI for annotation building | positional `input` (PDF file or dir), `--dpi` (200), `--out` (default `data/raw/exams`); names `{pdf_stem}_p{page}.png` |

### 6.12 Dependencies — `requirements.txt`

- **Web**: fastapi≥0.115, uvicorn[standard]≥0.32, pydantic≥2.9, pydantic-settings≥2.6, httpx≥0.27, python-multipart≥0.0.12.
- **Phase 2 (documents)**: ultralytics≥8.4, paddleocr≥3.7, paddlepaddle≥3.3, opencv-python-headless≥4.10, pymupdf≥1.24, pillow≥10.4, numpy≥1.26,<2.3. (The file instructs installing CPU-only torch/torchvision first so Ultralytics doesn't pull the ~2 GB CUDA build.)
- **Phase 3 (email)**: google-api-python-client≥2.150, google-auth-httplib2≥0.2, google-auth-oauthlib≥1.2.
- **Accounts**: bcrypt≥4.2.
- Constraint: **Python ≤ 3.13** (PaddlePaddle has no 3.14 wheels); the venv was built with `uv` on Python 3.12.

### 6.13 Environment Variables (`.env`, gitignored)

Set in `.env`: `SME_GOOGLE_CLIENT_ID`, `SME_GOOGLE_CLIENT_SECRET`, `SME_OLLAMA_MODEL=qwen3.5:9b`.
Supported but defaulted if unset: `SME_DB_PATH`, `SME_OLLAMA_HOST` (http://localhost:11434), `SME_OLLAMA_TIMEOUT_SECONDS` (5.0), `SME_YOLO_WEIGHTS_PATH_EXAMS` / `SME_YOLO_WEIGHTS_PATH_INVOICES`, `SME_PADDLEOCR_LANG` (en), `SME_UPLOAD_DIR`, `SME_CORS_ORIGINS`, `SME_GOOGLE_REDIRECT_URI`.
Process-level (set in code, not config): `PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False` (ocr_processor.py).

---

## 7. Custom YOLO Model Training

### 7.1 Dataset — `backend/data/datasets/exams`

`data.yaml` defines 10 classes: `lu_logo, question, subject, date, faculty, duration, semester, department, university_name, instructions`, built from **128 labeled Lebanese University exam pages**. Split counts: train 90, val 19, test 19. `data/raw/exams` holds 135 source PNGs and `data/raw/exams_labels` 128 label files. Dataset-building path: `pdf_to_images.py` → manual annotation (makesense.ai, persistent class order mandated by the data.yaml header comment) → `voc_to_yolo.py` → `split_dataset.py`.

Note: `data.yaml`'s `path:` points to a Linux path (`/home/hexbit/...`) from the training host; locally the split subdirectories exist under `data/datasets/exams/images|labels/{train,val,test}`.

### 7.2 Training configuration — `runs/detect/train/args.yaml`

- Base **`yolov8n.pt`** (pretrained on COCO), task `detect`, **epochs 100**, **patience 20**, **batch 4**, **imgsz 960**, **device cpu**, workers 8, seed 0, AMP on, `optimizer: auto`.
- Optimizer hyperparameters: `lr0 0.01, lrf 0.01, momentum 0.937, weight_decay 0.0005`; loss weights `box 7.5 / cls 0.5 / dfl 1.5`.
- Augmentation: `scale 0.5, translate 0.1, fliplr 0.5, mosaic 1.0, close_mosaic 10, erasing 0.4, auto_augment randaugment`; no rotation/perspective/mixup/cutmix.
- Training ran on a **Linux host** (paths in `args.yaml` and `save_dir` refer to `/home/hexbit/...`); the artifacts were copied into this repo.

### 7.3 Results & Metrics — `runs/detect/train/results.csv` (14-column Ultralytics CSV)

| Epoch | val/box_loss | val/cls_loss | val/dfl_loss | precision(B) | recall(B) | mAP50(B) | mAP50-95(B) |
|---|---|---|---|---|---|---|---|
| 1 | 2.607 | 4.543 | 2.356 | 0.0039 | 0.121 | 0.0075 | 0.0024 |
| **54** (best mAP50-95) | 1.409 | 1.944 | 1.582 | 0.592 | 0.706 | 0.678 | **0.4618** |
| **62** (best fitness 0.4838; plateau 61–63) | 1.429 | 1.851 | 1.543 | 0.525 | 0.700 | 0.747 | 0.4546 |
| 73 (early-stop) | 1.421 | 1.911 | 1.505 | 0.748 | 0.571 | 0.748 | 0.4530 |

Trend: val losses dropped (box 2.61→~1.42, cls 4.54→~1.85–1.94, dfl 2.36→~1.51–1.58); mAP50 plateaus at ~0.747; **best mAP50-95 0.462 @ epoch 54**; Ultralytics fitness (0.1·mAP50 + 0.9·mAP50-95) peaks at 0.4838 across epochs 61–63. Training **early-stopped at epoch 73/100** (20 epochs without improvement). `best.pt` (~6.3 MB) saved at the first best-fitness epoch (~61).

Model files in `backend/models/`: `exams.pt` (5.4 MB — exported best exam model), `invoices.pt` (20.3 MB — larger invoice-domain model), plus stock `yolov8n.pt` at the backend root. The invoice model's training artifacts are not present in this repo (only the trained weights).

---

## 8. Frontend System (React / Vite / Tailwind)

### 8.1 Build tooling — `frontend/package.json`, `vite.config.js`, `index.css`

- Scripts: `dev` (vite), `build`, `lint` (oxlint), `preview`. Dependencies: `react@19.2.8`, `react-dom`, `react-router-dom@7.18.3`, `lucide-react@1.45.0`; `recharts@3.10.1` is declared but **never imported** (the Dashboard hand-rolls its chart). DevDependencies: `vite@8.3.0`, `@vitejs/plugin-react@6.1.1` (Oxc-based React refresh), `tailwindcss@4.3.3` + `@tailwindcss/vite`, `@types/react(-dom)`, `oxlint@1.81.0`.
- `vite.config.js`: plugins `react()` + `tailwindcss()` (Tailwind v4 — there is **no** `tailwind.config.js` / `postcss.config.js`), dev server port **5173**, proxy `/api` → `http://localhost:8000` (changeOrigin), so the SPA calls same-origin `/api/...`.
- `src/index.css` (the only stylesheet, 15 lines): `@import "tailwindcss"`, class-based dark variant via `@custom-variant dark (&:where(.dark, .dark *))`, light/dark `color-scheme`, `body { @apply antialiased; }`. No custom `@theme` tokens — the Tailwind default palette (slate/indigo/purple/emerald/amber/red) + arbitrary values are used.
- `index.html`: title **"SME Automation — AI Business Process Assistant"**, `favicon.svg`.

### 8.2 Routing & Auth Guard — `src/App.jsx`

- **Theme**: `dark` initialized from `localStorage['sme-theme']`, else `prefers-color-scheme`; toggling flips the `.dark` class on `<html>` and persists.
- **Auth guard**: if a token exists (`getToken()`), `getMe()` validates it and populates `user`; otherwise the app goes straight to Login. Any 401 anywhere dispatches `sme:unauthorized` → `setUser(null)` (back to Login). While `checkingSession`, a slate full-screen placeholder is shown.
- Login renders **outside** `BrowserRouter`; the whole app shell mounts only once `user` is truthy.

| Path | Element | Access |
|---|---|---|
| `/` | `<Navigate to="/dashboard" replace />` | logged-in |
| `/dashboard` | `<Dashboard />` | logged-in |
| `/documents` | `<Documents />` | logged-in |
| `/invoices` | `<Invoices />` | logged-in |
| `/emails` | `<Emails />` (list ↔ board) | logged-in + Gmail-connection gate |
| `/voice` | `<Voice />` (AI Assistant) | logged-in |
| `/settings` | `<Settings />` | logged-in |
| `/users` | `<UserManagement />` | **admin only** (else Navigate → `/dashboard`) |

Shell: `<Sidebar user onLogout>` + `<Topbar dark onToggleTheme>` + scrollable `<main><Routes/>`. No nested layout routes — every page renders directly.

### 8.3 API Client — `src/services/api.js`

`request()` attaches the Bearer token from `localStorage['sme-auth-token']`; on any 401 it clears the token and dispatches `sme:unauthorized`; on `!res.ok` it throws `Error("{status} {detail}")`; on 204 it returns null; else JSON. Exports (path in parentheses): `getToken/setToken/clearToken`, `login` (POST /auth/login), `logout`, `getMe`, `listUsers/createUser/updateUser/deleteUser`, `listDocuments/getDocument/uploadDocument/deleteDocument/documentImageUrl` (query-string token for `<img>`), `detectPreview(blob, domain, signal)` (AbortSignal-driven live camera), `listInvoices/processInvoice/flagInvoiceField`, `getSystemStatus`, `runVoiceCommand` (POST /voice/command → `{action_taken, result}`), and the email set: `getEmailAuthStatus/getEmailAuthUrl/syncEmails/getEmailAccount/listEmails/getEmail/classifyEmail/summarizeEmail/draftEmail/sendEmail/markEmailRead/deleteEmail/restoreEmail/saveEmailPosition/nameSender` + `attachmentUrl` (token query string).

### 8.4 Global state & polling

- **No React context/store** — cross-page state is `App.jsx`'s `user`/`dark` plus window events and localStorage keys `sme-theme`, `sme-auth-token`, `sme-hide-promotions`.
- Polling is page-local: **Dashboard** every 5 s (`Promise.all([listDocuments, listInvoices, listEmails, getSystemStatus])`); **Documents** every 3 s *only while any document is `pending`/`processing`*; Invoices, Emails, and Voice refresh on demand.

### 8.5 Components (page-by-page)

- **layout/Sidebar.jsx** — brand header (indigo→purple gradient tile, Database icon, "SME Automation" / "AI Assistant" subtitle); nav items Dashboard (`LayoutDashboard`), Documents (`FileText`), Invoices (`Receipt`), Email Manager (`Mail`), AI Assistant (`Bot`); admin-only **User Management** (`Users`) appended; bottom has a pinned Settings link and a user card (emerald→teal avatar initial, username, "Administrator"/"User" role label) with a logout button.
- **layout/Topbar.jsx** — page-title map (Dashboard / Document Management / Invoice Processing / Email Manager / AI Assistant / Settings) + subtitle "AI-Powered Business Process Automation"; a decorative search box; a static Ollama status pill (pulsing dot — decorative; real checks happen on Dashboard/Voice); a dark-mode toggle (Sun/Moon); a decorative bell with red dot; and a **"Start Voice"** gradient button that navigates to `/voice`.
- **dashboard/Dashboard.jsx** — 4 stat tiles: **Documents Processed** (`FileText`, with "(n active)" for pending+processing), **Invoices Extracted** (`Receipt`, "(n review)"), **Emails Categorized** (`Inbox`, "of total"), **Awaiting Review** (`AlertTriangle`), each with a `TrendingUp` "live" badge from the 5 s poll. Two charts: a hand-rolled 7-day **Processing Volume** bar chart (documents grouped by `upload_date` date vs the last 7 days) and **Live Metrics** progress bars (Avg OCR Confidence, Emails Categorized %, Invoices Needing Review %). A pipeline legend shows YOLO Layout Detection / PaddleOCR Extraction / queue depth; a Recent Documents list (top 6, confidence bar + status pill via `STATUS_META`); and a **System Health** panel rendering the 4 probes (YOLO/PaddleOCR/Ollama/VoxType) Online/Offline, with `system.ollama.detail` surfaced when Ollama is offline. Headline is hardcoded "Welcome back, Karam"; "Quick Process" is decorative.
- **documents/Documents.jsx** — accepts `pdf/png/jpg/jpeg`; drag-and-drop + "Browse Files" + "Use Camera" (opens CameraCapture, domain `exams`). Uploads loop over `uploadDocument(file)`. Polls every 3 s only while a pipeline is running. "Active Pipeline" gradient card shows live active/queue counts. Filters: status pills (`All/Pending/Processing/Processed/Failed`) + filename search. Rows show file-type icon, filename, type/date, a confidence bar (green ≥90 / amber ≥75 / red), and a spinning "processing" status pill. Detail modal loads `getDocument(id)`, renders the **Detected Regions** overlay (`<img src={documentImageUrl}>` + a `<canvas>` redrawn by `drawRegions` on load/resize), "Text by Region" from `structured_json.regions_text`, "Extracted Fields" grid, "Raw OCR Text" `<pre>`, and failed-document error text.
- **documents/CameraCapture.jsx** — `getUserMedia({ facingMode: 'environment' })`; modal with an `aspect-[4/3]` viewport. **Live mode**: every 1.5 s (~4 s AbortController timeout, request-in-flight ref prevents stacking) it copies the video frame to a canvas, `toBlob('image/jpeg', 0.75)`, calls `detectPreview(blob, domain, signal)`, and draws the YOLO boxes live with an "n regions detected" badge. Capture stores a full-res JPEG (0.92); Use Photo wraps it as `capture_<ts>.jpg` and returns it via `onCapture`; Retake revokes the object URL.
- **documents/regionOverlay.js** — the shared OCR-box engine: `colorForLabel(label)` hashes a label to a hue; `drawRegions(canvas, mediaEl, regions, intrinsicSize)` letterboxes the render rect from the media element aspect vs the intrinsic image aspect, then per region draws `strokeRect` + a `"label pct%"` chip, sized so boxes map correctly onto both `<video>` and `<img>` under `object-fit: contain`. **`pattern_match` semantics**: server-side OCR validation — `true` → green (#4ade80) thick stroke ("this reading looks right"), `false` → orange (#fb923c) thick stroke, else label-hashed color thin. Shared by Documents, Invoices, and the live camera preview.
- **invoices/Invoices.jsx** — upload + camera both call `processInvoice(file)` (CameraCapture with domain `invoices`). Filters: `All / Needs Review / Confirmed`; search over invoice-number + vendor. The selected invoice's **source image + region overlay** are loaded through `getDocument(invoice.document_id)` + `documentImageUrl` + `drawRegions` (same pattern as Documents). Rows display `currency total`, a confidence bar, and an amber `Needs Review` / emerald `Confirmed` chip. Detail modal: mark-confirmed / flag-for-review toggle (`flagInvoiceField(id, 'all', ...)`), Extracted Fields grid (Invoice Number / Vendor / Date / Total), **Raw OCR Rows** from the `items` array, and the Detected-Regions canvas.

- **emails/Emails.jsx** — page controller. Mount flow: probe `getSystemStatus` for Ollama availability; parse `?gmail_connected`/`?gmail_error` query params (OAuth callback result → banner); check `getEmailAuthStatus`; if connected, `getEmailAccount()` and refresh the list. **Auth-gated rendering**: not configured → instructions card (Google Cloud console steps, redirect URI, `SME_GOOGLE_CLIENT_ID/SECRET` env vars in `backend/.env`); configured-but-unconnected → "Connect Gmail" card that jumps to `getEmailAuthUrl()`; connected → the workspace. Toolbar: category filter chips (`All/Urgent/Follow-up/Info/Action/Spam`), the **List / Map** segmented toggle, a **promotions toggle** persisted to `localStorage['sme-hide-promotions']`, **"Classify All"** which sequentially (single local model) runs `classifyEmail` over unclassified mails with a `{done,total}` progress indicator, a sync-range dropdown (30/60/90/all + custom date inputs) and **Sync Gmail**. List rows: avatar initial, bold-until-read subjects (except `direction='out'`), `custom_name || sender`, unread dot, "Summarized"/"Replied" badges, category chip, and mark/rename/delete actions. Detail modal wraps `EmailDetailPanel`. After sending, it refreshes so the backend-inserted outbound thread node appears on the board too. **Delete on the board is undo-able**: optimistic removal with an 8-second undo snackbar that calls `restoreEmail(email)`.
- **emails/EmailSpace.jsx** — the 2D map board. `REGION_META` maps categories to colors/classes: urgent #ef4444, action #a855f7, follow_up #f59e0b, informational #3b82f6, spam #94a3b8, `_unclassified` dashed. Layout math: regions packed 2-per-row (`REGION_W=1000`), threads grouped by `thread_id` (solo emails keyed by id), sorted by latest `received_date`; emails in a thread laid horizontally at `CARD_W(300)+NODE_GAP_X(110)` intervals; region width grows to fit its longest thread; a `WORLD_MARGIN=1600` expands the canvas on both axes. Cards clamp within their region when dragged. Thread branches are drawn as **cubic Bezier git-graph curves** on one board-wide `<svg>`, colored by region stroke, with a `GitBranch` icon above each thread head. Interactions: zoom-to-cursor wheel (native non-passive listener, `factor = e^{−Δy·0.0015}`, clamp 0.2–2.2), canvas pan dragging, card dragging via the card header (deltas divided by the current zoom, persisted to `/position` on mouseup). Server-persisted `pos_x/pos_y` are honored on first layout; a reclassify that changes a card's region snaps it back into the fresh auto-layout. Floating zoom controls (`ZoomIn ×1.25`, `ZoomOut ×0.8`, `Maximize2` reset/fit) and a hint bar. A card's drag survives re-layout only while its region key is unchanged.
- **emails/EmailBoardCard.jsx** — self-contained AI workspace on the card (`CARD_W 300`, `CARD_H 340`, max 480 with internal scroll). Outgoing rows get an emerald "conversation" style + "Reply sent" badge and no AI buttons. Generic `run(action, fn)` shows a busy spinner + error and merges the updated row up via `onUpdate`. Actions on-card: mark read/unread, rename sender (prompt → `nameSender`, then refetch so sibling cards update), delete (undo via parent), **Classify / Summarize / Draft·Regenerate** grid, optional draft instructions input, and **Reply** which lifts only the compose window to `ComposeModal`. Attachments render as `<a download href={attachmentUrl(...)}>`. An expandable "View original email" lazily calls `getEmail(id)` for the body.
- **emails/EmailDetailPanel.jsx** — the shared classify/summarize/draft/send workspace used in the list-view modal (props include `detail, actionError, actionLoading, draftText, composing, instructions, onClassify/onSummarize/onDraft/onReply/onSend/onMark/onRename/onDelete/onClose/openInBoard`). Shows subject + toolbar, From/To/category/unread, scrollable body `<pre>`, attachments, action-error strip, instructions input, the action button row, a purple AI Summary box, and a draft textarea + "Send Reply" section (disabled and relabeled "Sent Reply" once `detail.sent`).
- **emails/ComposeModal.jsx** — Gmail-style corner compose window (`fixed bottom-4 right-4 z-[70] w-[400px]`), outside the pan/zoom world. Subject auto-prefixed `Re: ` if needed; displays From (`accountEmail`) / To (`email.sender`); only the body is editable (autofocused); Send → `sendEmail(email.id, body)` → `onSent` → close; Discard closes. There is no standalone "new mail" path — sending always replies into the existing thread.
- **emails/emailMeta.js** — small constant map of category → display label + pill class (`Urgent/Follow-up/Info/Action/Spam`). All AI categorization happens server-side via `classifyEmail`; `EmailSpace.REGION_META` is the separate board-only color constant.
- **voice/Voice.jsx** — the AI Assistant page (§9).
- **settings/Settings.jsx** — **static / preference-only UI with no API wiring**; saving just flashes "Saved" (2.5 s). Cards: **Ollama LLM** (hardcoded model list with size/quality/speed + estimated RAM, temperature slider default 0.2, max-token select 2048/4096/8192, "Connected" badge), **YOLO Model** (hardcoded candidate list, confidence + IoU/NMS sliders), **VoxType Voice** (Dictation/Command/Hybrid radios, wake word, feedback/auto-transcribe toggles), **System** (SQLite storage bar 2.4/3.5 GB, Ollama endpoint + Test, backend endpoint), **Privacy & Security** (local-only storage on, no external AI calls, optional cloud-fallback API-key field with show/hide).
- **users/UserManagement.jsx** — admin-only CRUD: table of users (avatar, `username` + "(you)", `created_at`, role chip Shield/ShieldOff), "Add User" modal (username, password min 4, role select), role toggle and delete are **disabled for your own row**. Flagging that "you can't demote or delete yourself."
- **auth/Login.jsx** — full-screen centered card (Database logo tile, "SME Automation", "Sign in to continue"), labeled username/password inputs (username autofocused), loading spinner on submit, gradient "Sign In" button; errors strip the leading HTTP status code before display.

---

## 9. AI Assistant (Voice) Features

- Entry point: browser **SpeechRecognition** (`window.SpeechRecognition || window.webkitSpeechRecognition`; fallback message directs to Chrome/Edge), `lang='en-US'`, `interimResults=false`, single alternative; a normal text input is always available, so the page works without a microphone.
- **Quick commands**: "Check system status", "Document summary", "Invoice status", "Unread emails", "Categorize emails with Ollama", "What can you do?"; a reference **command palette** lists phrase→module hints; `STAT_TILES` renders documents/processed/invoices/needs_review/emails/unread counts under replies when present.
- Flow per command: `runVoiceCommand(text)` → backend intent router → reply text + optional stats → TTS via `speechSynthesis` (rate 1.05, text sanitized to `[a-zA-Z0-9 .,:;'!?-]` truncated to 320 chars, cancellable, mute toggle).
- UI: animated waveform bars while recording; header badges "Mic ready"/"Type to use" and "Ollama online/offline" (real check via `getSystemStatus`); auto-scroll chat; busy guard; a **"Private by design"** card emphasizing browser-side STT, the local FastAPI backend, and local Ollama ("no cloud processing").
- Backend behavior recap: intent routing + `_ai_fallback` grounded in live DB counts; **the endpoint can never return HTTP 500** — anything unexpected yields a graceful "Something hiccupped…" message.

---

## 10. Email Manager (List + Board/Map)

- **List view**: classic filtered inbox with AI actions in a detail modal (`EmailDetailPanel`).
- **Board/Map view**: a spatial canvas (`EmailSpace`) where emails are placed into category regions (urgent/action/follow_up/informational/spam + unclassified) and threaded emails are connected by curved git-graph branches; cards are draggable, positions persist to the DB (`/position`), zoom/pan/reset are supported, and a floating `ComposeModal` handles replies. Delete is undo-able for 8 seconds.
- **AI actions**: per-mail Classify / Summarize / Draft (Ollama profiles in §6.8), plus "Classify All" with progress. Drafts can be sent directly (approval gate: the user reviews the AI body before `sendEmail`), which inserts an outgoing thread node that appears on the board.
- **OAuth connection UX**: unconfigured → Gmail setup instructions; configured-unconnected → "Connect Gmail"; after the callback, the page lands back at `/emails?gmail_connected=1`.

---

## 11. Integration Verification & Runtime Facts

Verified working end-to-end on the development machine (Windows):

- **Login** `karam`/`12345` → Dashboard renders; session persists across reloads; logout works.
- **Documents & Invoices separation**: a normal upload appears only under Documents (list filtered on `doc_type='document'`); an invoice upload appears only under Invoices (backing row tagged `'invoice'`); deleting an invoice's backing document doesn't leak rows into the Documents page. Both tables were intentionally flushed to 0 during verification (13 docs / 9 invoices deleted); 15 synced emails were kept.
- **Live camera preview** (`detect-preview`) draws YOLO boxes + per-box OCR on the video frame; capture → upload → background pipeline (pending → processing → processed) with live 3 s polling; the detail modal shows the exact raster the model saw with the same overlay.
- **System health**: `/api/system/status` reports all probes; Ollama reports "connected, qwen3.5:9b loaded".
- **GPT/LLM**: switching the default to `qwen3.5:9b` (config + `SME_OLLAMA_MODEL` in `.env`) gives warm inference ~0.8 s on the RTX 4050 (6 GB VRAM, model largely resident); cold start after idle unload ~14 s. `think=False` is essential to keep responses fast.
- **Voice assistant**: greeting ("hello", "good morning"), smalltalk ("how are you"), help, "invoice status", "unread emails", "check system status", "categorize emails", and arbitrary questions ("thank you", "whats the weather today", "tell me a joke", gibberish) all return sensible replies — verified live; formatting bug (double `\n\n` output) fixed earlier.
- **Summary of current DB state**: 0 documents, 0 invoices, 15 emails (kept for the maps), uploads folder empty.

---

## 12. Current Status, Known Gaps & Notes

**Working:** auth/roles, all CRUD pages, documents pipeline (YOLO + PaddleOCR + field extraction), invoice processing + review flags, Gmail sync + AI triage (classify/summarize/draft/send), list & board email views, dashboard live stats, AI Assistant voice/text, system health, user management, light/dark theme.

**Known gaps / placeholders (important for the final PDF to be accurate):**

1. **Document summarization** endpoint is stubbed → always HTTP 501 ("Phase 3 (Ollama integration)"); no UI calls it.
2. **VoxType voice (Phase 4)** is a stub — `voice_handler` raises `NotImplementedError`; voice input is browser SpeechRecognition instead.
3. **Settings page is static** — its saved values are not persisted anywhere (no `/api/settings` wiring in the UI); the backend `/api/settings` endpoints exist but are only used internally for Gmail token storage.
4. **Topbar search and bells are decorative**; the Ollama pill in the Topbar is static.
5. **recharts dependency is unused** — the Dashboard chart is hand-rolled.
6. **`PLAN.md` (the original roadmap) is stale/pre-backend** — this report describes the implemented state.
7. **Classify All is sequential** (one local model) — acceptable for local use but worth noting.
8. The **invoice YOLO model's training artifacts are not in this repo** (only `invoices.pt` weights); the exam model's full run is documented in §7. Google OAuth requires app re-consent whenever scopes change (modify was added after initial tokens).
9. **Aesthetic/static realism**: the login uses a hardcoded seeded admin; the Dashboard headline is hardcoded "Welcome back, Karam".
10. Frontend `recharts`, `Settings` API endpoints, and document summarize are prime candidates for the "roadmap" narrative in the PDF.

---

## 13. Dev Tooling & How to Run

**Backend** (from `backend/`, after `.venv\Scripts\activate`):

```
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- API docs: http://127.0.0.1:8000/docs. Requires `.env` with the `SME_*` vars (§6.13). Python 3.12 venv; installed per the `requirements.txt` header (`uv python install 3.12 && uv venv --python 3.12 .venv`; CPU-only torch first).

**Frontend** (from `frontend/`):

```
npm run dev      # http://localhost:5173, /api proxied to :8000
```

**Windows one-click dev servers — `start-servers.ps1`:** spawns both dev servers as **WMI-orphaned processes** (`Invoke-CimMethod Win32_Process Create`) so they survive the parent PowerShell exiting; a scheduled task **`SME-Dev-Servers`** was registered with an `AtLogOn` trigger for `DESKTOP-883DEMN\Karim` (Interactivetoken, run-as logged-in user) executing `K:\Downloads\sme-automation\start-servers.ps1`, so the stack auto-starts at sign-in. `run.ps1` is the older runner.
- **Important**: the backend runs **without `--reload`**. After editing backend code you must manually restart: kill the process owning port 8000, then respawn via `Invoke-CimMethod`. (PowerShell's `$pid` is read-only — use a different variable name.)

**Dataset / training pipeline:** `scripts/pdf_to_images.py` (render) → annotate (makesense.ai) → `scripts/voc_to_yolo.py` → `scripts/split_dataset.py` → `scripts/train_yolo.py`.

---

## 14. Future Work

1. Implement real **document summarization** (Ollama, replaces the 501 stub) and wire the Settings UI to the `/api/settings` backend.
2. Incrementally improve the exam YOLO model (more classes/labels, GPU training, data.yaml path fix) and retrain / document the invoice model.
3. Full **VoxType** speech integration (native command routing) beyond browser SpeechRecognition.
4. Scale **Classify All** to run on a thread/queue instead of sequentially.
5. Multi-user hardenings: per-user settings, audit logging, password policies.
6. Packaging: single-command installer/launcher, Docker for the backend, and an HTTPS/production serve path.

---

## 15. Appendix A — Schema DDL (from `backend/app/database.py`)

```sql
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  upload_date TEXT NOT NULL DEFAULT (datetime('now')),
  processed INTEGER NOT NULL DEFAULT 0,
  raw_text TEXT,
  structured_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  doc_type TEXT NOT NULL DEFAULT 'document'  -- 'document' | 'invoice'
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  invoice_number TEXT,
  vendor TEXT,
  date TEXT,
  total REAL,
  currency TEXT,
  items_json TEXT,
  confidence_score REAL,
  needs_review INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT UNIQUE,
  thread_id TEXT,
  subject TEXT,
  sender TEXT,
  recipient TEXT,
  body TEXT,
  received_date TEXT,
  category TEXT,
  summary TEXT,
  drafted_reply TEXT,
  sent INTEGER NOT NULL DEFAULT 0,
  processed_date TEXT NOT NULL DEFAULT (datetime('now')),
  direction TEXT NOT NULL DEFAULT 'in',        -- 'in' | 'out'
  is_read INTEGER NOT NULL DEFAULT 1,          -- from Gmail UNREAD
  pos_x REAL, pos_y REAL,                      -- board coordinates
  gmail_category TEXT                          -- primary|social|promotions|updates|spam
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,                         -- Gmail attachmentId
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename TEXT, mime_type TEXT, size INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sender_names (
  sender_email TEXT PRIMARY KEY,               -- bare address
  custom_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voice_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_text TEXT NOT NULL,
  action_taken TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at INTEGER NOT NULL                  -- unix timestamp
);
```

---

## 16. Appendix B — Endpoint Summary Table

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/login | – | login, returns session token |
| POST | /api/auth/logout | Bearer | revoke session |
| GET | /api/auth/me | Bearer | current user |
| GET/POST /PATCH/DELETE | /api/users[/{id}] | admin | user management |
| GET/PUT | /api/settings | logged-in | generic key/value store (bulk upsert) |
| GET | /api/system/status | – | probe yolo/paddleocr/ollama/voxtype |
| POST/GET/GET/GET/DELETE/POST | /api/documents(/, /, /{id}, /{id}/image, /{id}, /summarize) + /detect-preview | logged-in | upload/list/detail/image/delete + live preview |
| POST/GET/POST | /api/invoices(/process, /, /{id}/flag) | logged-in | process/list/flag-invoice |
| POST | /api/voice/command | logged-in | AI assistant intent router |
| GET | /api/emails/auth/status, /auth/url | logged-in | OAuth state / start |
| GET | /api/emails/auth/callback | – | Google OAuth redirect target |
| POST | /api/emails/sync | logged-in | pull + upsert Gmail messages |
| GET | /api/emails/account | logged-in | connected account |
| GET | /api/emails(, /{id}) | logged-in | list / detail |
| POST | /api/emails/{id}/classify · summarize · draft · send · mark · position · name-sender | logged-in | AI + thread actions |
| DELETE | /api/emails/{id} | logged-in | trash + delete |
| POST | /api/emails/restore | logged-in | undo delete |
| GET | /api/emails/{id}/attachments/{aid} | logged-in | download attachment bytes |
| GET | / | – | API banner → /docs |

---

*End of report. Prepared for an AI-assisted rewrite into a polished ~20-page PDF.*