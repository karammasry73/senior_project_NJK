# Project Plan: AI-Powered SME Automation Assistant

**Final Year Project Plan & Roadmap**

## Project Title
**Development of an AI-Powered Intelligent Document Processing and Administrative Automation Assistant for Small and Medium Enterprises (SMEs)**

Based on the senior project proposal, this project automates repetitive administrative tasks for SMEs: invoice/receipt data extraction, email categorization & drafting, and document summarization — all running fully offline.

---

## 1. Objectives

1. Analyze administrative bottlenecks in SME business processes (invoicing, email handling).
2. Design and develop a web-based application automating these tasks.
3. Integrate AI — YOLO (detection), PaddleOCR (text extraction), Ollama LLM (understanding/structuring), VoxType (voice).
4. Evaluate performance: time saved, error reduction, accuracy metrics vs. manual processing.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React.js Frontend                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Dashboard │ │ Doc Mgmt │ │  Voice   │ │ Settings  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│   + Invoice Processing + Email Manager                  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API (HTTP /api/*)
┌───────────────────────┴─────────────────────────────────┐
│                  FastAPI Backend (Python)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Invoice  │ │  Email   │ │ Document │ │  Voice    │  │
│  │ Processor│ │ Manager  │ │ Summarizer│ │  Handler  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│  ┌────┴─────────────┴────────────┴──────────────┴─────┐  │
│  │              AI Processing Pipeline                 │  │
│  │  ┌─────────┐  ┌───────────┐  ┌─────────┐          │  │
│  │  │  YOLO   │  │ PaddleOCR │  │ Ollama  │          │  │
│  │  │ (Layout │  │  (Text &  │  │  (LLM)  │          │  │
│  │  │  +Field │  │   Table   │  │ offline │          │  │
│  │  │ Detection│  │Extraction)│  │ struct.)│          │  │
│  │  └─────────┘  └───────────┘  └─────────┘          │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  VoxType (Voice Input / Commands / Dictation)      │  │
│  └───────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│                    SQLite Database                       │
│  Documents │ Users │ Invoices │ Emails │ Settings        │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Component      | Technology                                        | Status      |
|----------------|---------------------------------------------------|-------------|
| Backend        | Python 3.11+ / FastAPI                            | To build    |
| Frontend       | React.js + Vite + TailwindCSS v4 + React Router   | Built       |
| UI Icons       | lucide-react                                      | Built       |
| Document Detect| YOLO (Ultralytics YOLOv8 nano) — layout + fields  | To integrate|
| OCR            | **PaddleOCR** (text + table recognition)          | To integrate|
| LLM (Offline)  | Ollama — llama3.1:8b / mistral / phi3             | To integrate|
| Voice Input    | VoxType (commands + dictation, hybrid mode)       | To integrate|
| PDF Processing | PyMuPDF / pdf2image                               | To integrate|
| Image Processing| OpenCV                                           | To integrate|
| Database       | SQLite                                            | To integrate|
| Theming        | Light + Dark (toggle in topbar, persisted)        | Built       |

**Key decision:** All AI tasks run fully offline via Ollama — no external API calls. PaddleOCR replaces Tesseract for superior table/line-item extraction on invoices.

---

## 4. Modules

### 4.1 Document Processing Pipeline (YOLO + PaddleOCR + Ollama)
- Upload image/PDF → render to image (PyMuPDF).
- **YOLO** detects layout regions and key fields (invoice #, date, total, vendor, line-item table, logo, signature).
- **PaddleOCR** extracts text, including structured table cells for line items.
- **Ollama** receives raw text + region hints and returns structured JSON.
- Store structured data in DB; expose via API.

### 4.2 Invoice Extraction
- Extract: invoice number, vendor, date, total, currency, line items.
- Confidence scoring per field; low-confidence fields flagged for review.
- YOLO bounding boxes drawn on document preview.

### 4.3 Email Manager
- Categorize (urgent / follow-up / informational / action / spam).
- Summarize threads; auto-draft professional replies via Ollama.
- Process attachments through the document pipeline.

### 4.4 Voice Interface (VoxType)
- Wake word ("Hey Assistant") → command mode: "process invoice", "summarize document", "draft email reply", etc.
- Hybrid mode: dictation vs. command auto-detection.
- Routing voice commands to backend API endpoints.

---

## 5. API Design (Backend)

```
POST /api/documents        — upload & process (multipart)
GET  /api/documents        — list documents
GET  /api/documents/{id}   — document detail (raw text, structured JSON)
DELETE /api/documents/{id} — delete

POST /api/invoices/process — process an invoice image/PDF
GET  /api/invoices         — list extracted invoices
POST /api/invoices/{id}/flag — confirm/reject low-confidence field

POST /api/emails/classify  — categorize email content
POST /api/emails/summarize — summarize email thread
POST /api/emails/draft     — draft a reply

POST /api/documents/summarize — summarize a document

POST /api/voice/command    — execute voice command text
GET  /api/system/status    — health of YOLO / PaddleOCR / Ollama / VoxType
GET  /api/settings         — config
PUT  /api/settings         — update config
```

---

## 6. Database Schema (SQLite)

```sql
Documents (id, filename, file_path, file_type, upload_date, processed,
           raw_text, structured_json, status, confidence)

Invoices (id, document_id, invoice_number, vendor, date, total, currency,
          items_json, confidence_score, needs_review)

Emails   (id, subject, sender, recipient, body, category, summary,
          drafted_reply, processed_date)

Summaries (id, document_id, summary_text, created_at)

VoiceCommands (id, command_text, action_taken, timestamp)

Settings (key, value)   -- ollama model, yolo weights, thresholds, vox mode
```

---

## 7. Repository Layout

```
~/Dev/sme-automation/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI entry point
│   │   ├── config.py              # settings
│   │   ├── database.py            # SQLite init
│   │   ├── models/                # Pydantic schemas
│   │   ├── routers/               # documents / invoices / emails / voice / settings
│   │   └── services/
│   │       ├── yolo_detector.py   # YOLOv8 detection
│   │       ├── ocr_processor.py   # PaddleOCR text + table extraction
│   │       ├── ollama_client.py   # Ollama API wrapper + prompts
│   │       ├── document_pipeline.py # orchestration
│   │       └── voice_handler.py   # VoxType integration
│   ├── models/                    # trained weights
│   ├── data/                      # sample docs + training data
│   └── requirements.txt
├── frontend/                      # React + Vite + Tailwind (BUILT)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/            # Sidebar, Topbar (theme toggle)
│   │   │   ├── dashboard/
│   │   │   ├── documents/
│   │   │   ├── invoices/
│   │   │   ├── emails/
│   │   │   ├── voice/
│   │   │   └── settings/
│   │   ├── services/api.js        # backend API client
│   │   └── App.jsx                # routing + theme state
│   └── package.json
└── PLAN.md                        # this file
```

---

## 8. Implementation Roadmap (16 weeks)

### Phase 1 — Foundation (Weeks 1–3) ✅/In progress
- ✅ Scaffold React frontend (Vite + TailwindCSS v4 + React Router)
- ✅ Build all 6 pages: Layout, Dashboard, Documents, Invoices, Emails, Voice, Settings
- ✅ Add dark theme + toggle
- ⏳ Scaffold FastAPI backend structure
- ⏳ Set up SQLite schema
- ⏳ Install & configure Ollama locally
- ⏳ Verify Ollama connection from backend

### Phase 2 — YOLO + PaddleOCR Document Processing (Weeks 4–6)
- Integrate YOLOv8 for document layout detection
- Fine-tune YOLO on invoice dataset (or use pre-trained DocLayNet weights)
- Integrate PaddleOCR (text + table recognition)
- Build pipeline: upload → YOLO detect → PaddleOCR extract
- Wire Documents + Invoices pages to real backend data

### Phase 3 — Ollama AI Integration (Weeks 7–9)
- Connect Ollama; craft prompts for extraction, classification, summarization
- Implement structured JSON extraction from OCR text
- Implement email categorize / summarize / draft
- Wire Email Manager page to API

### Phase 4 — VoxType Voice Interface (Weeks 10–11)
- Integrate VoxType for capture + dictation
- Build command routing to backend
- Wire Voice page to `/api/voice/command`

### Phase 5 — Polish & Testing (Weeks 12–13)
- End-to-end tests, UAT
- Confidence thresholds & edge cases (low-quality scans)
- Dashboard analytics from real data

### Phase 6 — Documentation & Presentation (Weeks 14–16)
- Thesis/documentation, README, GitHub repo
- Live demo + video walkthrough

---

## 9. Ollama Model Strategy

| Task                    | Model        | Notes                                  |
|-------------------------|--------------|----------------------------------------|
| Structured extraction   | llama3.1:8b  | JSON mode; low temperature (0.2)       |
| Summarization           | llama3.1:8b  | Concise business summaries             |
| Classification          | phi3 / mistral | Fast, accurate topic classification  |
| Email drafting          | llama3.1:8b  | Professional tone, instructed prompts  |

Single default model (llama3.1:8b) with task-specific system prompts keeps it simple.

---

## 10. Risks & Mitigations

| Risk                                | Mitigation                                  |
|-------------------------------------|---------------------------------------------|
| YOLO training too long              | Start pre-trained; fine-tune incrementally  |
| Ollama slow on local hardware       | Smaller models (phi3), truncated context    |
| PaddleOCR install complexity        | Pin versions; lazy-load in worker thread    |
| VoxType integration complexity      | Implement last; fallback to typed text input|
| Scope creep                         | MVP first; strict phase boundaries          |
| Dark theme polish                   | Already covered via CSS variant approach    |

---

## 11. Evaluation Criteria (for thesis)

- **Extraction accuracy** — % fields correctly extracted vs. ground truth
- **Time saved** — automated vs. manual processing time
- **Error reduction** — flag rate and false-positive rate
- **User satisfaction** — UAT questionnaire
- **Offline capability** — AI quality with zero network access

---

## 12. Current Status

| Area                 | Status                       |
|----------------------|------------------------------|
| Frontend layout      | ✅ Complete (all pages, dark theme) |
| Backend              | ⏳ Not started               |
| YOLO integration     | ⏳ Pending                   |
| PaddleOCR integration| ⏳ Pending                   |
| Ollama integration   | ⏳ Pending                   |
| VoxType integration  | ⏳ Pending                   |

**Next step:** Phase 1 backend — scaffold FastAPI, SQLite schema, and a working `/api/system/status` endpoint that reports Ollama/PaddleOCR/YOLO availability.