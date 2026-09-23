-- Secure legacy, archive, and RAG tables that are exposed through PostgREST.
--
-- Deployment order matters:
--   1. Deploy the matching application change first (it calls RAG RPCs using
--      the authenticated server session rather than an anonymous browser client).
--   2. Run this migration in the Supabase SQL Editor immediately afterwards.
--
-- The RAG tables remain usable only through the two scoped RPCs below. Their
-- direct REST/table endpoints are intentionally closed to anon/authenticated
-- clients. Ingestion scripts continue to use SUPABASE_SERVICE_ROLE_KEY.

BEGIN;

-- These are legacy lookup/archive tables with no browser-side consumer. Keep
-- them available to trusted server-side jobs, but deny PostgREST clients.
ALTER TABLE public.assessment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_scores_archive ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.assessment_categories, public.assessment_pillars,
  public.report_scores_archive FROM anon, authenticated;
GRANT ALL ON TABLE public.assessment_categories, public.assessment_pillars,
  public.report_scores_archive TO service_role;

-- The RAG source tables contain internal curriculum and diagnostic guidance.
-- They must not be enumerable/downloadable by direct API access.
ALTER TABLE public.cia_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_knowledge ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cia_criteria, public.pdf_knowledge FROM anon, authenticated;
GRANT ALL ON TABLE public.cia_criteria, public.pdf_knowledge TO service_role;

-- `match_pdf_knowledge` previously existed in both four- and five-argument
-- variants on some projects, which makes PostgREST's named-argument lookup
-- ambiguous. Keep exactly the secure five-argument form.
DROP FUNCTION IF EXISTS public.match_pdf_knowledge(vector, float, int, uuid);
DROP FUNCTION IF EXISTS public.match_pdf_knowledge(vector, float, int);

CREATE OR REPLACE FUNCTION public.match_cia_criteria(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  target_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id INT,
  category TEXT,
  theme TEXT,
  indicator TEXT,
  sub_indicator TEXT,
  similarity FLOAT,
  organization_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.category,
    c.theme,
    c.indicator,
    c.sub_indicator,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.organization_id
  FROM public.cia_criteria AS c
  WHERE target_organization_id IS NOT NULL
    AND public.is_organization_member(target_organization_id)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (c.organization_id IS NULL OR c.organization_id = target_organization_id)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_pdf_knowledge(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.15,
  match_count INT DEFAULT 5,
  target_organization_id UUID DEFAULT NULL,
  target_knowledge_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  section TEXT,
  page_start INTEGER,
  similarity FLOAT,
  organization_id UUID,
  knowledge_type TEXT,
  source_document TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    k.id,
    k.content,
    k.section,
    k.page_start,
    1 - (k.embedding <=> query_embedding) AS similarity,
    k.organization_id,
    k.knowledge_type,
    k.source_document
  FROM public.pdf_knowledge AS k
  WHERE target_organization_id IS NOT NULL
    AND public.is_organization_member(target_organization_id)
    AND 1 - (k.embedding <=> query_embedding) > match_threshold
    AND (k.organization_id IS NULL OR k.organization_id = target_organization_id)
    AND (target_knowledge_type IS NULL OR k.knowledge_type = target_knowledge_type)
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Function privileges are separate from table privileges. Restrict the two
-- controlled read paths to authenticated application sessions and server jobs.
REVOKE ALL ON FUNCTION public.match_cia_criteria(vector, float, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_pdf_knowledge(vector, float, int, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_cia_criteria(vector, float, int, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.match_pdf_knowledge(vector, float, int, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_cia_criteria(vector, float, int, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_pdf_knowledge(vector, float, int, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
