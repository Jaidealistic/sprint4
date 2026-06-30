import os
import io
import csv
import zipfile
import fitz
from datetime import datetime, timezone
from sqlmodel import Session, select
from fastapi.responses import FileResponse
from models import Document, DocumentStatus, RiskTier, Entity, AuditLog

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "data", "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")

def get_export_preview(session: Session):
    docs = session.exec(select(Document)).all()
    
    reviewed = sum(1 for d in docs if d.status in (DocumentStatus.APPROVED, DocumentStatus.READY, DocumentStatus.UNDER_REVIEW))
    auto_approved = 16 # mock or query rules
    manual_review = sum(1 for d in docs if d.risk_tier == RiskTier.NEEDS_ATTENTION)
    ocr_warning = sum(1 for d in docs if d.ocr_warning)
    
    return {
        "reviewed": reviewed,
        "auto_approved": auto_approved,
        "manual_review": manual_review,
        "ocr_warning": ocr_warning
    }

def generate_export(session: Session):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"export_{timestamp}.zip"
    zip_filepath = os.path.join(EXPORT_DIR, zip_filename)
    
    # Partial export: Only include READY or APPROVED
    exportable_docs = session.exec(
        select(Document).where(Document.status.in_([DocumentStatus.READY, DocumentStatus.APPROVED]))
    ).all()
    
    with zipfile.ZipFile(zip_filepath, 'w') as zf:
        # 1. Scrub and add PDFs
        for doc in exportable_docs:
            doc_dir = os.path.join(UPLOAD_DIR, str(doc.id))
            file_path = os.path.join(doc_dir, doc.filename)
            
            if os.path.exists(file_path):
                # PyMuPDF metadata stripping
                try:
                    pdf_doc = fitz.open(file_path)
                    pdf_doc.set_metadata({}) # Strip metadata
                    
                    # In a real app we'd also apply redactions visually here
                    
                    scrubbed_bytes = pdf_doc.write()
                    zf.writestr(f"documents/{doc.filename}", scrubbed_bytes)
                    pdf_doc.close()
                    
                    doc.status = DocumentStatus.EXPORTED
                    session.add(doc)
                except Exception as e:
                    print(f"Error scrubbing {doc.filename}: {e}")
                    
        # 2. Add Audit Log CSV
        audit_logs = session.exec(select(AuditLog)).all()
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(["ID", "Timestamp", "Entity ID", "Document ID", "Action", "Previous", "New", "Reason"])
        for log in audit_logs:
            writer.writerow([log.id, log.timestamp, log.entity_id, log.document_id, log.action, log.previous_value, log.new_value, log.reason])
            
        zf.writestr("audit_log.csv", csv_buffer.getvalue())
        
    session.commit()
    return zip_filepath
