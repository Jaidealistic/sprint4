# Maestro - Development Writeup

## What Was Built

Maestro is a flow-first document review workspace built with a FastAPI/SQLModel backend and a React/TypeScript/Tailwind frontend. 

### Key Features Implemented:
1. **Intelligent Upload Pipeline:** Users can drop bulk case files into the app. Files are chunked and hashed (SHA-256) to prevent duplicates. A background processing pipeline analyzes text (mock PII detection), assigns a risk tier (`NEEDS_ATTENTION`, `QUICK_REVIEW`, `READY`), and groups identical entities into clusters.
2. **Review Ergonomics:** The `DocumentViewer` component heavily relies on a Keyboard Loop. Reviewers can use `J`/`K` to navigate entities, and `A`/`R` to approve or reject them. These actions are instantly reflected via an Optimistic UI.
3. **True Redaction Mechanics:** Approving an entity visibly mutates the DOM, replacing the PII with a `[REDACTED]` span, ensuring no visual leakage.
4. **Resilient Session State:** The application utilizes a robust `SessionContext` wired to `localStorage`. Refreshing the app mid-review reliably restores the current active panel, document, and filter buckets.
5. **Safety-first Export:** A dedicated End-of-Day Check dashboard calculates flow metrics. Only `READY` and `APPROVED` documents are cleared for export. We utilize `PyMuPDF` to physically strip embedded metadata from PDFs before packaging them into a ZIP archive alongside a full CSV Audit Log.

## What Was Deliberately Cut

Given the scope and constraints (No Auth, No Redis), the following deliberate architectural trade-offs were made:
1. **Actual Machine Learning:** The "PII extraction" logic uses mock regex rather than integrating a heavy Spacy/Transformer pipeline to ensure the backend stays lightweight and starts instantly.
2. **Real-time Collaboration / WebSockets:** Polling and manual refresh mechanisms were used over WebSockets, since the requirements specifically requested a single-user local flow.
3. **Advanced PDF Rendering:** To maintain extreme frontend simplicity, the Document Viewer renders raw extracted text with annotated HTML spans instead of attempting to overlay interactive bounding boxes over a `<canvas>` PDF renderer (like PDF.js), which is often brittle and overcomplicated for a simple text review prototype.
4. **Complex Macro Logic:** While the DB architecture supports creating rules to auto-approve entities based on string matches, the complex UI matrix to build these queries was skipped in favor of a simpler, linear J/K review loop.
