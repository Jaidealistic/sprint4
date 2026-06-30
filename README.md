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
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to access the application.

## Core Principles

- **No Auth, No Multi-user**: Designed for a single paralegal reviewing local files.
- **SQLite & Local Storage**: Maximum portability. No Redis, no external databases.
- **Keyboard-first Navigation**: J/K for navigation, A/R for approve/reject, Ctrl+Z for undo.
- **Optimistic UI**: Instant visual feedback on interactions, background API sync.

## Project Structure

- `/backend`: FastAPI and SQLModel (SQLite). Handles multi-part file uploads, mock text extraction and PII clustering, and export packaging (PyMuPDF).
- `/frontend`: React, Vite, Tailwind. Minimal external dependencies (`react-dropzone`). Uses `SessionContext` backed by `localStorage` for state persistence.
