-- ============================================================
-- Migration: pdf_knowledge table + match_pdf_knowledge RPC
--
-- Stores chunked text from the full KMS PDF (all sections
-- EXCEPT pages 75–253, which are already in cia_criteria).
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS pdf_knowledge (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT        NOT NULL,          -- The raw text chunk (~300–400 words)
  section     TEXT,                           -- Human-readable section name from TOC
  page_start  INTEGER,                        -- First page of this chunk
  page_end    INTEGER,                        -- Last page of this chunk
  embedding   VECTOR(1536)                    -- text-embedding-3-small
);

-- 2. IVFFlat index for fast cosine similarity search
--    (lists = 100 is a good default for up to ~100k rows)
CREATE INDEX IF NOT EXISTS pdf_knowledge_embedding_idx
  ON pdf_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 3. RPC function: returns top-N most similar knowledge chunks
CREATE OR REPLACE FUNCTION match_pdf_knowledge(
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT   DEFAULT 0.15,
  match_count      INT     DEFAULT 5
)
RETURNS TABLE (
  id          BIGINT,
  content     TEXT,
  section     TEXT,
  page_start  INTEGER,
  similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    pdf_knowledge.id,
    pdf_knowledge.content,
    pdf_knowledge.section,
    pdf_knowledge.page_start,
    1 - (pdf_knowledge.embedding <=> query_embedding) AS similarity
  FROM pdf_knowledge
  WHERE 1 - (pdf_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY pdf_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;
