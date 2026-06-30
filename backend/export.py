import os
import io
import csv
import json
import zipfile
import fitz  # PyMuPDF
from datetime import datetime, timezone
from sqlmodel import Session, select
from models import Document, DocumentStatus, RiskTier, Entity, EntityDecision, AuditLog

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "data", "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "uploads")


def get_export_preview(session: Session):
    docs = session.exec(select(Document)).all()

    reviewed = sum(1 for d in docs if d.status in (
        DocumentStatus.APPROVED, DocumentStatus.READY,
        DocumentStatus.UNDER_REVIEW, DocumentStatus.EXPORTED
    ))
    auto_approved = sum(1 for d in docs if d.risk_tier == RiskTier.READY)
    manual_review = sum(1 for d in docs if d.risk_tier in (
        RiskTier.NEEDS_ATTENTION, RiskTier.QUICK_REVIEW
    ))
    ocr_warning = sum(1 for d in docs if d.ocr_warning)

    return {
        "reviewed": reviewed,
        "auto_approved": auto_approved,
        "manual_review": manual_review,
        "ocr_warning": ocr_warning,
        "total": len(docs),
    }


def _is_doc_fully_decided(doc: Document, session: Session) -> bool:
    """Returns True if every entity in this doc has a non-PENDING decision."""
    entities = session.exec(
        select(Entity).where(Entity.document_id == doc.id)
    ).all()
    if not entities:
        return True  # No entities = clean doc
    return all(e.decision != EntityDecision.PENDING for e in entities)


def _apply_redactions(pdf_doc: fitz.Document, entities: list[Entity], text_content: str):
    """
    Apply visible black-box redactions over REJECTED entity text in the PDF.
    Uses PyMuPDF's built-in search_for to locate text on each page, then
    adds redaction annotations and applies them.
    """
    approved_texts = set(
        e.text for e in entities if e.decision == EntityDecision.APPROVED
    )

    if not approved_texts:
        return  # Nothing to redact visually

    for page in pdf_doc:
        for text in approved_texts:
            # Find all instances of this text on the page
            rects = page.search_for(text)
            for rect in rects:
                # Add redaction annotation (black fill)
                page.add_redact_annot(rect, fill=(0, 0, 0))
        # Apply all redaction annotations on this page
        page.apply_redactions()


def generate_export(session: Session):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"maestro_export_{timestamp}.zip"
    zip_filepath = os.path.join(EXPORT_DIR, zip_filename)

    # Smart eligibility:
    # - READY: no entities, export as-is
    # - APPROVED: explicitly approved by user
    # - UNDER_REVIEW: include only if ALL entities are decided (no pending left)
    all_docs = session.exec(select(Document)).all()

    exportable_docs = []
    for doc in all_docs:
        if doc.status in (DocumentStatus.READY, DocumentStatus.APPROVED, DocumentStatus.EXPORTED):
            exportable_docs.append(doc)
        elif doc.status == DocumentStatus.UNDER_REVIEW:
            if _is_doc_fully_decided(doc, session):
                exportable_docs.append(doc)

    manifest = {
        "export_timestamp": timestamp,
        "total_documents_in_session": len(all_docs),
        "documents_exported": len(exportable_docs),
        "documents_skipped": len(all_docs) - len(exportable_docs),
        "files": []
    }

    with zipfile.ZipFile(zip_filepath, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. Process and add PDFs
        for doc in exportable_docs:
            doc_dir = os.path.join(UPLOAD_DIR, str(doc.id))
            file_path = os.path.join(doc_dir, doc.filename)

            if not os.path.exists(file_path):
                manifest["files"].append({
                    "filename": doc.filename,
                    "status": "SKIPPED - file not found on disk"
                })
                continue

            try:
                is_pdf = doc.filename.lower().endswith('.pdf')

                if is_pdf:
                    pdf_doc = fitz.open(file_path)
                    # Strip all metadata
                    pdf_doc.set_metadata({})
                    # Apply visual redactions for REJECTED entities
                    entities = session.exec(
                        select(Entity).where(Entity.document_id == doc.id)
                    ).all()
                    _apply_redactions(pdf_doc, entities, doc.text_content or "")
                    scrubbed_bytes = pdf_doc.tobytes(garbage=4, deflate=True)
                    zf.writestr(f"documents/{doc.filename}", scrubbed_bytes)
                    pdf_doc.close()
                else:
                    # Non-PDF text file: replace REJECTED entity text with [REDACTED]
                    # NOTE: We use text-search (not offsets) because PyMuPDF reformats
                    # txt files during extraction, making stored offsets unreliable.
                    entities = session.exec(
                        select(Entity).where(Entity.document_id == doc.id)
                    ).all()

                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                            text = f.read()

                        import re
                        approved_texts = sorted(
                            set(e.text.strip() for e in entities if e.decision == EntityDecision.APPROVED and e.text.strip()),
                            key=len,
                            reverse=True  # replace longer matches first to avoid partial replacements
                        )
                        for entity_text in approved_texts:
                            # Escape special regex chars in the entity text
                            escaped = re.escape(entity_text)
                            text = re.sub(escaped, '[REDACTED]', text)

                        zf.writestr(f"documents/{doc.filename}", text.encode('utf-8'))
                    except Exception as txt_err:
                        print(f"Error redacting text file {doc.filename}: {txt_err}")
                        with open(file_path, 'rb') as f:
                            zf.writestr(f"documents/{doc.filename}", f.read())


                # Mark as exported
                doc.status = DocumentStatus.EXPORTED
                session.add(doc)

                rejected_count = sum(1 for e in entities if e.decision == EntityDecision.REJECTED)
                approved_count = sum(1 for e in entities if e.decision == EntityDecision.APPROVED)

                manifest["files"].append({
                    "filename": doc.filename,
                    "status": "EXPORTED",
                    "entities_total": len(entities),
                    "entities_approved_keep": approved_count,
                    "entities_redacted": rejected_count,
                    "risk_tier": doc.risk_tier,
                })

            except Exception as e:
                print(f"Error processing {doc.filename}: {e}")
                manifest["files"].append({
                    "filename": doc.filename,
                    "status": f"ERROR: {str(e)}"
                })

        # 2. Audit Log CSV
        audit_logs = session.exec(
            select(AuditLog).order_by(AuditLog.timestamp)
        ).all()
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow([
            "ID", "Timestamp", "Entity ID", "Document ID",
            "Action", "Previous Decision", "New Decision", "Reason"
        ])
        for log in audit_logs:
            writer.writerow([
                log.id, log.timestamp, log.entity_id, log.document_id,
                log.action, log.previous_value, log.new_value, log.reason
            ])
        zf.writestr("audit_log.csv", csv_buffer.getvalue())

        # 3. Manifest JSON
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, default=str))

    session.commit()
    return zip_filepath
