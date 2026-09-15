-- scripts/migrations/20260915_prioritize_diagnostic_guidance.sql
--
-- Lets the app retrieve diagnostic-guidance chunks in a dedicated semantic
-- search. Without this, broad existing knowledge can occupy every candidate
-- slot before the new source is considered.
--
-- Run once in the Supabase SQL Editor after
-- 20260915_diagnostic_guidance_knowledge.sql.

-- Replace the previous four-argument version instead of keeping an overload.
-- Both functions accept the same first four named arguments, which otherwise
-- makes PostgREST unable to choose the general-search function.
DROP FUNCTION IF EXISTS public.match_pdf_knowledge(vector, float, int, uuid);

CREATE OR REPLACE FUNCTION public.match_pdf_knowledge(
  query_embedding          VECTOR(1536),
  match_threshold          FLOAT DEFAULT 0.15,
  match_count              INT   DEFAULT 5,
  target_organization_id   UUID  DEFAULT NULL,
  target_knowledge_type    TEXT  DEFAULT NULL
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
    AND (target_knowledge_type IS NULL OR pdf_knowledge.knowledge_type = target_knowledge_type)
  ORDER BY pdf_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_pdf_knowledge(vector, float, int, uuid, text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
