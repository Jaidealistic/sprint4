import time
import random
import re
from datetime import datetime, timezone
from sqlmodel import Session, select
from models import Document, DocumentStatus, RiskTier, Entity, EntityDecision, Cluster

def process_document(doc_id: int, file_path: str, engine):
    """
    Background task to process a document.
    """
    with Session(engine) as session:
        # 1. Mark as processing
        doc = session.get(Document, doc_id)
        if not doc:
            return
        
        doc.status = DocumentStatus.PROCESSING
        doc.updated_at = datetime.now(timezone.utc)
        session.add(doc)
        session.commit()
        session.refresh(doc)
        
        try:
            # 2. Extract text (mock for now, or use PyMuPDF)
            import fitz # PyMuPDF
            text_content = ""
            page_count = 0
            try:
                pdf_doc = fitz.open(file_path)
                page_count = pdf_doc.page_count
                for page in pdf_doc:
                    text_content += page.get_text()
                pdf_doc.close()
            except Exception as e:
                print(f"Error reading PDF: {e}")
                # Fallback to mock text if reading fails (e.g., mock files)
                text_content = "This is a mock document containing John Doe and jane.doe@example.com."
                page_count = 1

            doc.page_count = page_count
            doc.text_content = text_content
            
            # 3. Mock PII detection
            # Let's use simple regex for demonstration: emails and capitalized words (names)
            emails = re.finditer(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text_content)
            names = re.finditer(r'\b[A-Z][a-z]+\s[A-Z][a-z]+\b', text_content)
            
            detected_entities = []
            for match in emails:
                detected_entities.append({
                    "text": match.group(0),
                    "type": "EMAIL",
                    "start": match.start(),
                    "end": match.end()
                })
            for match in names:
                detected_entities.append({
                    "text": match.group(0),
                    "type": "PERSON",
                    "start": match.start(),
                    "end": match.end()
                })
                
            # Create entities in DB
            for ent_data in detected_entities:
                entity = Entity(
                    document_id=doc.id,
                    text=ent_data["text"],
                    type=ent_data["type"],
                    start_offset=ent_data["start"],
                    end_offset=ent_data["end"],
                    confidence=random.uniform(0.7, 0.99)
                )
                session.add(entity)
            session.commit()
            
            # 4. Exact-match clustering
            # We cluster by exact text match across the whole DB
            entities = session.exec(select(Entity).where(Entity.document_id == doc.id)).all()
            for entity in entities:
                # Find if a cluster already exists for this exact text
                cluster = session.exec(select(Cluster).where(Cluster.representative_text == entity.text)).first()
                if not cluster:
                    cluster = Cluster(representative_text=entity.text, entity_type=entity.type, member_count=0)
                    session.add(cluster)
                    session.commit()
                    session.refresh(cluster)
                
                # Assign cluster to entity
                entity.cluster_id = cluster.id
                cluster.member_count += 1
                session.add(entity)
                session.add(cluster)
            session.commit()
            
            # 5. Risk scoring
            # High entities -> NEEDS_ATTENTION, else QUICK_REVIEW or READY
            num_entities = len(entities)
            doc.risk_score = min(1.0, num_entities * 0.1)
            if num_entities > 5:
                doc.risk_tier = RiskTier.NEEDS_ATTENTION
            elif num_entities > 0:
                doc.risk_tier = RiskTier.QUICK_REVIEW
            else:
                doc.risk_tier = RiskTier.READY
                
            # 6. Update status
            doc.status = DocumentStatus.UNDER_REVIEW if num_entities > 0 else DocumentStatus.READY
            doc.updated_at = datetime.now(timezone.utc)
            session.add(doc)
            session.commit()
            
        except Exception as e:
            print(f"Error processing document {doc_id}: {e}")
            doc.status = DocumentStatus.PROCESSING_FAILED
            doc.updated_at = datetime.now(timezone.utc)
            session.add(doc)
            session.commit()
