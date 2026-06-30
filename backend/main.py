import os
import hashlib
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from sqlmodel import Session, select

from database import engine, create_db_and_tables, get_session
from models import Document, DocumentStatus, Entity
from processing import process_document

UPLOAD_DIR = "/data/uploads"
# Since we are local, let's just make it relative to the backend or use absolute path
# For local dev, let's use a local folder within backend:
LOCAL_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")
os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="Maestro Review Workspace API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/documents")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session)
):
    results = []
    
    for file in files:
        file_bytes = await file.read()
        content_hash = hashlib.sha256(file_bytes).hexdigest()
        
        # Check duplicate
        existing_doc = session.exec(select(Document).where(Document.content_hash == content_hash)).first()
        if existing_doc:
            results.append({
                "filename": file.filename,
                "duplicate": True,
                "document_id": existing_doc.id
            })
            continue
            
        # Create new document record
        new_doc = Document(
            filename=file.filename,
            content_hash=content_hash,
            status=DocumentStatus.QUEUED
        )
        session.add(new_doc)
        session.commit()
        session.refresh(new_doc)
        
        # Save file to disk
        doc_dir = os.path.join(LOCAL_UPLOAD_DIR, str(new_doc.id))
        os.makedirs(doc_dir, exist_ok=True)
        file_path = os.path.join(doc_dir, file.filename)
        
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        # Schedule background task
        background_tasks.add_task(process_document, new_doc.id, file_path, engine)
        
        results.append({
            "filename": file.filename,
            "duplicate": False,
            "document_id": new_doc.id
        })
        
    return {"results": results}

@app.get("/api/status/batch")
def get_batch_status(since: Optional[float] = None, session: Session = Depends(get_session)):
    query = select(Document)
    if since is not None:
        since_dt = datetime.fromtimestamp(since)
        # Using simple timezone offset issue avoidance (assume all UTC)
        # Wait, since is just float timestamp, let's compare with updated_at timestamp
        # It's better to fetch and filter in Python for this small MVP or use proper SQLite dialect conversion
        pass 
    
    # Let's just return everything modified for MVP, and filter in code to avoid tz issues
    docs = session.exec(query).all()
    
    if since is not None:
        since_dt = datetime.fromtimestamp(since).astimezone()
        docs = [d for d in docs if d.updated_at.astimezone() > since_dt]
        
    # Return delta updates
    return {
        "documents": docs,
        "timestamp": datetime.now().timestamp()
    }

@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, session: Session = Depends(get_session)):
    doc = session.get(Document, doc_id)
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document not found")
        
    entities = session.exec(select(Entity).where(Entity.document_id == doc_id)).all()
    
    return {
        "document": doc,
        "entities": entities
    }

@app.get("/api/search")
def search_entities(q: str = Query(..., min_length=1), session: Session = Depends(get_session)):
    query = select(Entity, Document.filename).join(Document).where(Entity.text.like(f"%{q}%"))
    results = session.exec(query).all()
    
    formatted = []
    for entity, filename in results:
        formatted.append({
            "entity": entity,
            "document_id": entity.document_id,
            "document_filename": filename
        })
        
    return {"results": formatted}

class DecisionRequest(BaseModel):
    decision: str # "approved" or "rejected"

@app.post("/api/entities/{entity_id}/decision")
def update_entity_decision(entity_id: int, req: DecisionRequest, session: Session = Depends(get_session)):
    entity = session.get(Entity, entity_id)
    if not entity:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Entity not found")
        
    entity.decision = req.decision
    entity.decided_at = datetime.now(timezone.utc)
    
    # Also mark doc as updated
    doc = session.get(Document, entity.document_id)
    if doc:
        doc.updated_at = datetime.now(timezone.utc)
        session.add(doc)
        
    session.add(entity)
    session.commit()
    
    return {"status": "ok", "entity": entity}

@app.get("/api/export/preview")
def export_preview(session: Session = Depends(get_session)):
    from export import get_export_preview
    return get_export_preview(session)

@app.post("/api/export")
def perform_export(session: Session = Depends(get_session)):
    from export import generate_export
    from fastapi.responses import FileResponse
    zip_path = generate_export(session)
    return FileResponse(zip_path, filename=os.path.basename(zip_path), media_type="application/zip")

# Run with: uvicorn main:app --reload
