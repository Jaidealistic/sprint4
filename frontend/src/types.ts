export enum DocumentStatus {
  UPLOADED = "UPLOADED",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  READY = "READY",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  EXPORT_READY = "EXPORT_READY",
  EXPORTED = "EXPORTED",
  PROCESSING_FAILED = "PROCESSING_FAILED",
  MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"
}

export enum RiskTier {
  NEEDS_ATTENTION = "needs_attention",
  QUICK_REVIEW = "quick_review",
  READY = "ready"
}

export enum EntityDecision {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected"
}

export enum ActivePanel {
  ENTITIES = "entities",
  SEARCH = "search",
  AUDIT = "audit"
}

export interface Document {
  id: number;
  filename: string;
  content_hash: string;
  status: DocumentStatus;
  risk_tier: RiskTier | null;
  risk_score: number | null;
  page_count: number | null;
  ocr_warning: boolean;
  created_at: string;
}

export interface Entity {
  id: number;
  document_id: number;
  text: string;
  type: string;
  start_offset: number;
  end_offset: number;
  confidence: number;
  decision: EntityDecision;
  cluster_id: number | null;
  decided_at: string | null;
  decided_by_rule_id: number | null;
}

export interface Cluster {
  id: number;
  representative_text: string;
  entity_type: string;
  member_count: int;
}

export interface Rule {
  id: number;
  description: string;
  condition_json: string;
  action: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  entity_id: number | null;
  document_id: number | null;
  timestamp: string;
  action: string;
  previous_value: string | null;
  new_value: string | null;
  reason: string | null;
}

export interface SessionState {
  id: number;
  current_document_id: number | null;
  scroll_position: number;
  zoom_level: number;
  active_filter: string | null;
  active_panel: ActivePanel;
  last_updated: string;
  is_exporting: boolean;
}
