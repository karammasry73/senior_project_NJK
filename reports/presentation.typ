#set page(paper: "presentation-16-9", margin: (x: 1.8cm, y: 1.4cm))
#set text(font: "Adwaita Sans", size: 18pt, lang: "en")

#let accent = rgb("#4f46e5")
#let accent-light = rgb("#eef2ff")
#let dim = rgb("#64748b")

#let slide(title: none, kicker: none, body) = {
  block(width: 100%, height: 100%)[
    #if kicker != none [
      #text(size: 13pt, fill: dim, tracking: 0.15em)[#upper(kicker)]
      #v(-0.3em)
    ]
    #if title != none [
      #text(size: 30pt, weight: "bold", fill: rgb("#0f172a"))[#title]
      #v(0.15em)
      #line(length: 100%, stroke: 2pt + accent)
      #v(0.6em)
    ]
    #body
  ]
  pagebreak(weak: true)
}

#let pt(body) = text(size: 17pt)[#body]

// ---------------------------------------------------------------- Title
#block(width: 100%, height: 100%, fill: gradient.linear(rgb("#4338ca"), rgb("#6d28d9"), angle: 45deg), inset: 0pt)[
  #place(center + horizon)[
    #box(width: 85%)[
      #align(center)[
        #text(size: 15pt, fill: rgb("#c7d2fe"), tracking: 0.2em)[SENIOR PROJECT · SYSTEM OVERVIEW]
        #v(0.8em)
        #text(size: 34pt, weight: "bold", fill: white)[
          AI-Powered Intelligent Document Processing \
          and Administrative Automation Assistant
        ]
        #v(1em)
        #text(size: 17pt, fill: rgb("#e0e7ff"))[Karam Masry · September 2026]
      ]
    ]
  ]
]
#pagebreak(weak: true)

// ---------------------------------------------------------------- Agenda
#slide(title: "What This Covers", kicker: "Agenda")[
  #grid(columns: 2, gutter: 1.5em,
    [
      #pt[*The problem and objectives*]
      #v(0.3em)
      #pt[*System architecture and tech stack*]
      #v(0.3em)
      #pt[*The AI pipeline* — YOLO, PaddleOCR, Ollama]
      #v(0.3em)
      #pt[*Two trained models* — exams and invoices, kept separate]
      #v(0.3em)
      #pt[*Live camera recognition*]
    ],
    [
      #pt[*User accounts & access control*]
      #v(0.3em)
      #pt[*Email Manager* — Gmail + local AI, fully live]
      #v(0.3em)
      #pt[*The Email Canvas* — a 2D board for conversations]
      #v(0.3em)
      #pt[*Engineering challenges solved*]
      #v(0.3em)
      #pt[*Current status and what's next*]
    ]
  )
]

// ---------------------------------------------------------------- Problem
#slide(title: "The Problem", kicker: "Motivation")[
  #pt[Small and medium enterprises lose real time to repetitive administrative work:]
  #v(0.6em)
  - Manually typing invoice data into spreadsheets
  - Reading, sorting, and replying to routine email
  - Summarizing long documents by hand
  #v(0.8em)
  #block(fill: accent-light, inset: 14pt, radius: 6pt, width: 100%)[
    #pt[*Constraint from day one:* everything runs on local, offline AI — no per-document cloud API costs, and sensitive business/student data never has to leave the machine.]
  ]
]

// ---------------------------------------------------------------- Objectives
#slide(title: "Objectives", kicker: "Project Plan")[
  + Analyze administrative bottlenecks in SME workflows (invoicing, email handling)
  + Design and build a web application that automates these tasks end to end
  + Integrate AI for detection (YOLO), text extraction (PaddleOCR), understanding (Ollama), and email (Gmail API)
  + Evaluate real performance: accuracy, time saved, error reduction vs. manual work
]

// ---------------------------------------------------------------- Architecture
#slide(title: "System Architecture", kicker: "Design")[
  #align(center)[
    #block(stroke: 1pt + dim, radius: 6pt, inset: 14pt, width: 90%)[
      #align(center)[*React Frontend*  (Vite · TailwindCSS · React Router)]
    ]
    #v(0.4em) #text(fill: dim)[REST API — HTTP calls to /api/...] #v(0.4em)
    #block(stroke: 1pt + dim, radius: 6pt, inset: 14pt, width: 90%)[
      #align(center)[*FastAPI Backend*  (Python · SQLite · bcrypt + token sessions)]
    ]
    #v(0.4em) ↓ #v(0.4em)
    #block(stroke: 1pt + accent, radius: 6pt, inset: 14pt, width: 90%, fill: accent-light)[
      #align(center)[*AI Pipeline* — YOLOv8 → PaddleOCR #text(size: 13pt, fill: dim)[(documents)]  ·  Ollama #text(size: 13pt, fill: dim)[(email intelligence)]  ·  Gmail API #text(size: 13pt, fill: dim)[(mail in/out)]]
    ]
  ]
]

// ---------------------------------------------------------------- Tech stack
#slide(title: "Technology Stack & Resources", kicker: "What It's Built On")[
  #set text(size: 14pt)
  #table(
    columns: (1fr, 2.2fr),
    stroke: 0.5pt + rgb("#e2e8f0"),
    inset: (x: 8pt, y: 5pt),
    [*Layer*], [*Tools*],
    [Frontend], [React 19, Vite, TailwindCSS v4, React Router, lucide-react],
    [Backend], [FastAPI, SQLite, Pydantic, `uv` (isolated Python 3.12 env)],
    [Auth], [bcrypt password hashing, opaque bearer-token sessions, role-based access],
    [Detection], [Ultralytics YOLOv8 (two fine-tuned models, ≥50% confidence, per-class caps)],
    [OCR], [PaddleOCR 3.7 / PaddlePaddle (CPU inference)],
    [Language model], [Ollama, local (qwen3.5:4b, CPU) — classification, summarization, drafting],
    [Email], [Gmail API, OAuth2 (read, send, modify), custom 2D canvas UI (no charting library)],
    [Labeling], [make-sense.ai — self-hosted from source],
    [Documents], [PyMuPDF (PDF rendering), Typst (this deck + the written report)],
  )
]

// ---------------------------------------------------------------- Frontend
#slide(title: "Frontend", kicker: "What's Built")[
  #pt[A full, authenticated application — every page wired to real backend data:]
  #v(0.5em)
  #grid(columns: 4, gutter: 0.9em,
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Dashboard*],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Documents* \ upload · camera · live detect],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Invoices* \ same, invoice-tuned],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Email Manager* \ list + 2D canvas views],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Voice Assistant*],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Settings*],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*Login*],
    block(stroke: 0.5pt + rgb("#e2e8f0"), radius: 6pt, inset: 10pt)[*User Management* \ admin-only],
  )
  #v(0.6em)
  #pt[Plus a persisted dark/light theme across the whole app.]
]

// ---------------------------------------------------------------- Backend
#slide(title: "Backend", kicker: "What's Built")[
  - FastAPI application with a full SQLite schema: documents, invoices, emails, attachments, sender names, summaries, voice commands, users, sessions, settings
  - `/api/system/status` — genuinely checks (not assumes) whether YOLO, PaddleOCR, Ollama, and voice are live
  - Session-based auth: every route gated behind a bearer token, admin-only routes enforced server-side
  - Background-task processing so uploads respond instantly while detection/OCR run behind the scenes
  - Schema evolves in place — new columns/tables are added via safe in-app migrations, existing data is never dropped
]

// ---------------------------------------------------------------- Pipeline
#slide(title: "The AI Pipeline", kicker: "How a Document Gets Processed")[
  + Upload (PDF or image) → rendered to a raster image if needed
  + *YOLO* proposes bounding boxes for the regions it recognizes
  + *PaddleOCR* reads the whole page for a general transcript
  + PaddleOCR runs *again on each individual region* YOLO detected
  #v(0.4em)
  #block(fill: accent-light, inset: 12pt, radius: 6pt)[
    #pt[Result: text comes back already tied to its meaning — `{"subject": "Calculus II"}`, not an anonymous line in a wall of text.]
  ]
]

// ---------------------------------------------------------------- Two models
#slide(title: "Two Specialized Models, Kept Separate", kicker: "Detection")[
  #table(
    columns: (1fr, 1fr),
    stroke: 0.5pt + rgb("#e2e8f0"),
    inset: 10pt,
    [*exams.pt* — 10 classes], [*invoices.pt* — 16 classes],
    [lu_logo, question, subject, date, faculty, duration, semester, department, university_name, instructions],
    [invoice number, invoice date, total, header, Products, Tax, Subtotal, Discount, billing/shipping address, client contact, …],
  )
  #v(0.6em)
  #pt[Each page (Documents vs. Invoices) explicitly loads the right model. Detections below *50% confidence* are dropped, and single-occurrence exam fields (logo, duration, subject) are capped to their real-world count — the highest-confidence box wins if the model reports duplicates.]
]

// ---------------------------------------------------------------- Dataset
#slide(title: "Building the Exam Dataset", kicker: "Labeling Workflow")[
  #pt[Real invoices are hard to collect in bulk as a student. Lebanese University exam papers were a genuinely useful stand-in — structurally similar (header, logo, boxed fields) and available in quantity.]
  #v(0.5em)
  - Labeled with *make-sense.ai, self-hosted* — exam images carry student names/IDs, so nothing goes to a third-party server
  - Grew from *23 → 128* labeled images across departments as more became available
  - Two annotation batches arrived in different formats (YOLO `.txt`, Pascal VOC `.xml`) — unified with a custom converter
  #v(0.5em)
  #table(
    columns: 5, stroke: 0.5pt + rgb("#e2e8f0"), inset: 8pt,
    [lu-exam], [buscomp], [civileng], [comms], [indeng],
    [23], [44], [61], [0], [0],
  )
]

// ---------------------------------------------------------------- Training results
#slide(title: "First Training Run — Honest Results", kicker: "Validation")[
  #pt[YOLOv8n fine-tuned on 128 images, 90/19/19 split, CPU-only: 73 epochs, roughly 12 minutes.]
  #v(0.5em)
  - Overall mAP50 ≈ *0.68* — but the class with real sample size tells the true story
  - `question` (9 real val instances): *0.89 mAP50* — genuinely strong
  - Verified on a *held-out* exam page the model never saw: correctly located and read out a real multi-part question about Dijkstra's algorithm
  #v(0.5em)
  #block(fill: rgb("#fef3c7"), inset: 12pt, radius: 6pt)[
    #pt[Two thinnest-box classes underperformed with only about 20 examples each — expected, and the clear next lever is more labeled data, not a different architecture.]
  ]
]

// ---------------------------------------------------------------- Live camera
#slide(title: "Live Camera Recognition", kicker: "Feature")[
  - Point the camera at a document — boxes track detected fields in *near real time*
  - Each frame is also OCR'd (rate-limited to the top few boxes, mirroring reference desktop-script behavior)
  - OCR's job here is *not* to display text live — it validates the box: a green outline means the reading matches what that field should look like (a real date in a date box); orange means it doesn't
  #v(0.5em)
  #pt[Same mechanism, two independent models — Documents uses the exam model, Invoices uses the invoice model.]
]

// ---------------------------------------------------------------- User accounts
#slide(title: "User Accounts & Access Control", kicker: "Security")[
  - Passwords hashed with *bcrypt* — never stored or logged in plain text
  - Login issues an opaque bearer token (7-day session), not a JWT — nothing about the user is decodable client-side
  - Every API route is gated behind authentication by default; admin-only routes (user management) are enforced *server-side*, not just hidden in the UI
  - A *User Management* page lets an admin create accounts, change roles, and remove users — with guardrails against locking yourself out (can't demote/delete the last admin, or yourself)
]

// ---------------------------------------------------------------- Email (AI)
#slide(title: "Email Manager — Local AI, Fully Live", kicker: "Gmail + Ollama")[
  - Gmail API (OAuth2) fetches and sends mail — the one piece that necessarily talks to the cloud
  - *Everything else stays local*: Ollama classifies (urgent / follow-up / action / info / spam), summarizes threads, and drafts replies — optionally steered with custom instructions
  - *Classify All* runs Ollama across every unclassified email in one pass
  - Sending is *gated behind explicit review* — a Gmail-style compose window (From/To/Subject shown, body editable) opens for every reply, AI-drafted or fully manual, and nothing goes out until Send is clicked
  - Mark read/unread, delete-to-trash with one-click undo, attachment download, and per-sender custom nicknames — all synced back to Gmail, not just the local cache
]

// ---------------------------------------------------------------- Email Canvas
#slide(title: "The Email Canvas", kicker: "A 2D Board for Conversations")[
  #pt[Instead of a flat inbox list, email lives on an *infinite pannable, zoomable board*:]
  #v(0.4em)
  - *Bordered regions* group email by AI-assigned category (Urgent, Action, Follow-up, Info, Spam) — each its own zone on the canvas
  - *Threads branch visually*: a reply exchange draws as connected nodes with a smooth curved line, colored by category — a real back-and-forth is instantly readable as a chain, not scattered rows
  - Reclassifying an email *snaps its card into the correct region automatically*; dragging a card is clamped to stay inside its own category's box
  - Card positions are *saved to the server per email* — the layout you build persists across reloads and re-syncs
  #v(0.4em)
  #block(fill: accent-light, inset: 10pt, radius: 6pt)[
    #pt[Every card is a full workspace on its own — classify, summarize, draft, reply, mark read, delete, all without leaving the canvas.]
  ]
]

// ---------------------------------------------------------------- Challenges
#slide(title: "Engineering Challenges Solved", kicker: "The Unglamorous Half")[
  #set text(size: 14pt)
  - System Python (3.14) too new for PaddlePaddle → isolated Python 3.12 via `uv`
  - PyTorch's default install pulls roughly 2GB of unused CUDA libs on this GPU-less machine → CPU-only wheel
  - PaddlePaddle 3.3.1 CPU inference crashed (oneDNN bug) → traced to a specific env flag fix
  - PaddleOCR 3.x's real API differs completely from older documented examples → rewritten against what's actually installed
  - Gmail OAuth silently failed ("missing code verifier") → real PKCE state-handling bug, found and fixed
  - A reasoning-capable Ollama model generated 3000+ tokens of hidden "thinking" for a five-word reply (7+ minutes) → traced via the server's own timing log, fixed with a single API flag
  - Adding a new Gmail permission scope silently broke the *existing* connection on token refresh → caught and degraded gracefully to "reconnect", instead of a server error
]

// ---------------------------------------------------------------- Status
#slide(title: "Current Status vs. Roadmap", kicker: "Where Things Stand")[
  #set text(size: 14pt)
  #table(
    columns: (1.8fr, 1fr),
    stroke: 0.5pt + rgb("#e2e8f0"),
    inset: (x: 9pt, y: 5pt),
    [*Area*], [*Status*],
    [Frontend (8 views, auth-gated, dark theme)], [Done],
    [Backend + SQLite schema], [Done],
    [User accounts, roles, admin management], [Done],
    [YOLO + PaddleOCR pipeline, both domains], [Done],
    [Exam model trained & validated], [Done — scaling dataset],
    [Invoice model integrated], [Done — needs real-world testing],
    [Camera capture + live recognition], [Done],
    [Gmail + Ollama email pipeline], [Done — live end to end],
    [Email Canvas (2D board, branches, positions)], [Done],
    [Voice input (VoxType)], [Not started],
  )
]

// ---------------------------------------------------------------- Next
#slide(title: "What's Next", kicker: "Roadmap")[
  + Label a larger, department-balanced batch (comms, indeng) and retrain on GPU hardware
  + Test the invoice model against real invoice photos, not synthetic test images
  + Extend Ollama beyond email into document *field structuring* — today's document extraction is region + regex based, not LLM-assisted
  + Begin voice input (VoxType) — intentionally last, since it depends on the document pipeline being solid first
]

// ---------------------------------------------------------------- Closing
#block(width: 100%, height: 100%, fill: gradient.linear(rgb("#4338ca"), rgb("#6d28d9"), angle: 45deg), inset: 0pt)[
  #place(center + horizon)[
    #align(center)[
      #text(size: 30pt, weight: "bold", fill: white)[Thank You]
      #v(0.6em)
      #text(size: 16pt, fill: rgb("#e0e7ff"))[Questions welcome.]
    ]
  ]
]
