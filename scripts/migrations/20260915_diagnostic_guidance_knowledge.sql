-- scripts/migrations/20260915_diagnostic_guidance_knowledge.sql
--
-- Adds provenance to narrative RAG rows. Scoring criteria remain exclusively
-- in cia_criteria; pdf_knowledge also holds source-labelled guidance that can
-- help the assistant form and verify non-clinical developmental hypotheses.
--
-- Run once in the Supabase SQL Editor before ingesting diagnostic guidance.

ALTER TABLE public.pdf_knowledge
  ADD COLUMN IF NOT EXISTS knowledge_type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS source_document TEXT;

ALTER TABLE public.pdf_knowledge
  DROP CONSTRAINT IF EXISTS pdf_knowledge_knowledge_type_check;

ALTER TABLE public.pdf_knowledge
  ADD CONSTRAINT pdf_knowledge_knowledge_type_check
  CHECK (knowledge_type IN ('general', 'diagnostic_guidance'));

CREATE INDEX IF NOT EXISTS idx_pdf_knowledge_source_document
  ON public.pdf_knowledge(source_document)
  WHERE source_document IS NOT NULL;

-- The return shape changes, so the existing four-argument function must be
-- dropped before it can be recreated with the new provenance fields.
DROP FUNCTION IF EXISTS public.match_pdf_knowledge(vector, float, int, uuid);
DROP FUNCTION IF EXISTS public.match_pdf_knowledge(vector, float, int);

CREATE OR REPLACE FUNCTION public.match_pdf_knowledge(
  query_embedding         VECTOR(1536),
  match_threshold         FLOAT DEFAULT 0.15,
  match_count             INT   DEFAULT 5,
  target_organization_id  UUID  DEFAULT NULL
)
RETURNS TABLE (
  id              BIGINT,
  content         TEXT,
  section         TEXT,
  page_start      INTEGER,
  similarity      FLOAT,
  organization_id UUID,
  knowledge_type  TEXT,
  source_document TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    pdf_knowledge.id,
    pdf_knowledge.content,
    pdf_knowledge.section,
    pdf_knowledge.page_start,
    1 - (pdf_knowledge.embedding <=> query_embedding) AS similarity,
    pdf_knowledge.organization_id,
    pdf_knowledge.knowledge_type,
    pdf_knowledge.source_document
  FROM public.pdf_knowledge
  WHERE 1 - (pdf_knowledge.embedding <=> query_embedding) > match_threshold
    AND (pdf_knowledge.organization_id IS NULL OR pdf_knowledge.organization_id = target_organization_id)
  ORDER BY pdf_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_pdf_knowledge(vector, float, int, uuid)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
