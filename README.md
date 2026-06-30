# Maestro

A flow-first document review workspace that lets paralegals process hundreds of documents by spending attention only on what's uncertain.

## Quickstart

Run the following command to start both the backend and frontend simultaneously:

```bash
# Terminal 1: Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn[standard] sqlmodel PyMuPDF python-multipart pydantic
# IMPORTANT: Run without --reload on Windows to prevent port locking/zombie processes
python -B -m uvicorn main:app --port 8001

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to access the application (the frontend Vite proxy will automatically route `/api` calls to port 8001).

## Core Principles

- **No Auth, No Multi-user**: Designed for a single paralegal reviewing local files.
- **SQLite & Local Storage**: Maximum portability. No Redis, no external databases.
- **Keyboard-first Navigation**: J/K for navigation, A/R for approve/reject, Ctrl+Z for undo.
- **Optimistic UI**: Instant visual feedback on interactions, background API sync.

## Project Structure

- `/backend`: FastAPI and SQLModel (SQLite). Handles multi-part file uploads, mock text extraction and PII clustering, and export packaging (PyMuPDF).
- `/frontend`: React, Vite, Tailwind. Minimal external dependencies (`react-dropzone`). Uses `SessionContext` backed by `localStorage` for state persistence.

## Testing Guide for Evaluators

Here is how to test the application to see how it specifically solves Maya's problem of "Working at Volume":

### 1. Test the "Zero-Mouse" Workflow
* **What to do:** Open a document from the "Needs Attention" bucket. Click inside the document to focus it. Take your hand off the mouse. Press `J` to jump to the first highlighted entity. Press `A` to redact it. Press `J` again to jump to the next, and `R` to keep it. Try pressing `Ctrl+Z` to undo your last action. 
* **Problem solved:** High-volume users (like Maya) lose massive amounts of time moving between the keyboard and mouse. By making the core review loop 100% keyboard-driven with instant optimistic UI updates, we eliminate mechanical friction and prevent RSI.

### 2. Test "Smart Entity Clustering"
* **What to do:** Find an entity that appears multiple times in a document (e.g., a specific name). Use the `J` key or click on it. Press `A` to redact it. Notice that *all other instances* of that exact entity in the document instantly turn black and are resolved as well. 
* **Problem solved:** Reviewing the exact same boilerplate name 15 times in a single document causes severe cognitive fatigue. Resolving all identical instances at once respects the user's time.

### 3. Test the "Flow-State" Undo Stack
* **What to do:** Rapidly press `A` on a few entities, then realize you made a mistake. Instead of hunting for a "Change Status" dropdown menu, simply press `Ctrl+Z` multiple times. Watch the UI instantly revert your decisions sequentially.
* **Problem solved:** Tools that require confirmation dialogs ("Are you sure?") interrupt flow. We traded annoying popups for a deep, forgiving undo stack, encouraging the user to work as fast as possible without fear of irreversible mistakes.

### 4. Test the "End-of-Day Check" (Export Pipeline)
* **What to do:** Leave at least one document with "Pending" (yellow) entities. Fully resolve all entities in another document (so it has 0 pending). Click "Export batch" in the bottom left. Observe the dashboard. Click "Export X Documents". Extract the downloaded ZIP file and open the PDF.
* **Problem solved:** First, it proves the concept of **Smart Partial Exports** — the system doesn't block the whole batch because of one unfinished file; it exports what is safe. Second, opening the exported PDF proves **True Redaction**: you cannot highlight the text under the black boxes because PyMuPDF physically scrubbed the text layer and metadata, protecting Maya from catastrophic legal leaks. Open the included `audit_log.csv` to see the exact chain of accountability for every decision.
