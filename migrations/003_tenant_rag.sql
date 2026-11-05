-- Tenant isolation for RAG. Existing unassigned documents remain inaccessible to tenant-scoped queries until explicitly assigned.
ALTER TABLE knowledge_documents DROP CONSTRAINT IF EXISTS knowledge_documents_category_source_ref_key;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_tenant_source_ref_uq
  ON knowledge_documents(agency_id, category, source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_documents_tenant_active_category
  ON knowledge_documents(agency_id, is_active, category);
