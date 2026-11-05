CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS knowledge_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, category text NOT NULL CHECK(category IN ('property_listing','faq','business_information')),
 language text NOT NULL CHECK(language IN ('en','sw','both')), content text NOT NULL, source_ref text, metadata jsonb NOT NULL DEFAULT '{}',
 content_hash text NOT NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(category,source_ref)
);
CREATE TABLE IF NOT EXISTS knowledge_chunks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
 chunk_index integer NOT NULL, content text NOT NULL, embedding vector(1536) NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,chunk_index)
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS knowledge_documents_metadata_gin ON knowledge_documents USING gin(metadata);
CREATE INDEX IF NOT EXISTS knowledge_documents_active_category ON knowledge_documents(is_active,category);
