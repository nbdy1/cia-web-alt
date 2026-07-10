-- ─────────────────────────────────────────────────────────────────────────────
-- Recreate / repair the RAG (vector search) objects used by the AI chat.
--
-- Fixes BOTH:
--   • "Could not find the function public.match_cia_criteria(...)"  (missing fn)
--   • "operator does not exist: jsonb <=> vector"                   (embedding
--     column came back as jsonb instead of vector after a restore/rollback)
--
-- Strategy: ensure the vector extension exists, convert any jsonb embedding
-- column back to vector(1536) IN PLACE (preserves existing rows), then recreate
-- the match_* functions. Idempotent — safe to run repeatedly.
--
-- These tables hold GLOBAL framework knowledge (not tenant data), so no RLS.
-- Run the whole file in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- Building the ivfflat index over existing pdf_knowledge rows needs more working
-- memory than Supabase's 32 MB default. Raise it for this session only.
-- (Lower to '128MB' if your instance is very small; it must exceed the "memory
-- required" figure in the 54000 error.)
SET maintenance_work_mem = '256MB';

-- Drop the functions first — they depend on the column type we're about to fix.
DROP FUNCTION IF EXISTS public.match_cia_criteria(vector, float, int);
DROP FUNCTION IF EXISTS public.match_pdf_knowledge(vector, float, int);

-- ── cia_criteria ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cia_criteria (
  id            SERIAL PRIMARY KEY,
  category      TEXT NOT NULL,
  theme         TEXT NOT NULL,
  indicator     TEXT NOT NULL,
  sub_indicator TEXT NOT NULL,
  search_text   TEXT NOT NULL,
  embedding     VECTOR(1536)
);

-- If the embedding column exists but isn't a vector (e.g. jsonb), convert it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cia_criteria'
      AND column_name = 'embedding' AND udt_name <> 'vector'
  ) THEN
    ALTER TABLE public.cia_criteria
      ALTER COLUMN embedding TYPE vector(1536)
      USING NULLIF(embedding::text, 'null')::vector(1536);
  END IF;
END $$;

-- ── pdf_knowledge ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pdf_knowledge (
  id         BIGSERIAL PRIMARY KEY,
  content    TEXT NOT NULL,
  section    TEXT,
  page_start INTEGER,
  page_end   INTEGER,
  embedding  VECTOR(1536)
);

-- Drop the ivfflat index before any type change (a column type can't be altered
-- while an index depends on it), convert if needed, then recreate the index.
DROP INDEX IF EXISTS public.pdf_knowledge_embedding_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pdf_knowledge'
      AND column_name = 'embedding' AND udt_name <> 'vector'
  ) THEN
    ALTER TABLE public.pdf_knowledge
      ALTER COLUMN embedding TYPE vector(1536)
      USING NULLIF(embedding::text, 'null')::vector(1536);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pdf_knowledge_embedding_idx
  ON public.pdf_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── Functions ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_cia_criteria (
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count     INT
)
RETURNS TABLE (
  id            INT,
  category      TEXT,
  theme         TEXT,
  indicator     TEXT,
  sub_indicator TEXT,
  similarity    FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    cia_criteria.id,
    cia_criteria.category,
    cia_criteria.theme,
    cia_criteria.indicator,
    cia_criteria.sub_indicator,
    1 - (cia_criteria.embedding <=> query_embedding) AS similarity
  FROM public.cia_criteria
  WHERE 1 - (cia_criteria.embedding <=> query_embedding) > match_threshold
  ORDER BY cia_criteria.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_pdf_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.15,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id         BIGINT,
  content    TEXT,
  section    TEXT,
  page_start INTEGER,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    pdf_knowledge.id,
    pdf_knowledge.content,
    pdf_knowledge.section,
    pdf_knowledge.page_start,
    1 - (pdf_knowledge.embedding <=> query_embedding) AS similarity
  FROM public.pdf_knowledge
  WHERE 1 - (pdf_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY pdf_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── Grants + reload PostgREST cache ───────────────────────────────────────────
GRANT ALL ON public.cia_criteria, public.pdf_knowledge TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_cia_criteria(vector, float, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_pdf_knowledge(vector, float, int) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- If cia_criteria is empty (embeddings were lost), re-ingest — source data is in
-- the repo:
--     npx tsx scripts/ingest-framework.ts
-- pdf_knowledge (optional, needs the external KMS PDF):
--     python3 scripts/ingest-pdf-knowledge.py --pdf /path/to/FullQCB.pdf
-- ─────────────────────────────────────────────────────────────────────────────
