from enum import Enum
from typing import Optional
from datetime import datetime, timezone
from sqlmodel import Field, SQLModel

class DocumentStatus(str, Enum):
    UPLOADED = "UPLOADED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    EXPORT_READY = "EXPORT_READY"
    EXPORTED = "EXPORTED"
    PROCESSING_FAILED = "PROCESSING_FAILED"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"

class RiskTier(str, Enum):
    NEEDS_ATTENTION = "needs_attention"
    QUICK_REVIEW = "quick_review"
    READY = "ready"

class EntityDecision(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class ActivePanel(str, Enum):
    ENTITIES = "entities"
    SEARCH = "search"
    AUDIT = "audit"

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    content_hash: str
    status: DocumentStatus
    risk_tier: Optional[RiskTier] = None
    risk_score: Optional[float] = None
    page_count: Optional[int] = None
    ocr_warning: bool = False
    text_content: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Entity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="document.id")
    text: str
    type: str
    start_offset: int
    end_offset: int
    confidence: float
    decision: EntityDecision = EntityDecision.PENDING
    cluster_id: Optional[int] = Field(default=None, foreign_key="cluster.id")
    decided_at: Optional[datetime] = None
    decided_by_rule_id: Optional[int] = Field(default=None, foreign_key="rule.id")

class Cluster(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    representative_text: str
    entity_type: str
    member_count: int = 0

class Rule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    condition_json: str
    action: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entity_id: Optional[int] = Field(default=None, foreign_key="entity.id")
    document_id: Optional[int] = Field(default=None, foreign_key="document.id")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    action: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None

class SessionState(SQLModel, table=True):
    id: Optional[int] = Field(default=1, primary_key=True) # Singleton
    current_document_id: Optional[int] = Field(default=None, foreign_key="document.id")
    scroll_position: float = 0.0
    zoom_level: float = 1.0
    active_filter: Optional[str] = None
    active_panel: ActivePanel = ActivePanel.ENTITIES
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
