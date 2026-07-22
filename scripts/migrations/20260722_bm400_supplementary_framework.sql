-- scripts/migrations/20260722_bm400_supplementary_framework.sql
--
-- Lets a single organization (initially SMA Bakti Mulya 400 Jakarta,
-- 0bc3db16-d270-42d9-893a-c233a6b83800) layer additional CDS
-- themes/indicators/sub-indicators on top of the global framework, sourced
-- from their own "Naskah Akademis Tiga Pilar" reference document — without
-- affecting any other organization.
--
-- cia_criteria (scoring criteria) and pdf_knowledge (narrative/theory RAG
-- chunks) were previously 100% global (see scripts/recreate_rag_functions.sql
-- header: "These tables hold GLOBAL framework knowledge (not tenant data)").
-- This adds a nullable organization_id: NULL rows stay global/shared (every
-- existing row, and every future org that doesn't have its own supplement),
-- non-NULL rows are visible only when querying as that organization.
--
-- Run this whole file once in the Supabase SQL Editor.

ALTER TABLE public.cia_criteria
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.pdf_knowledge
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_cia_criteria_organization_id ON public.cia_criteria(organization_id);
CREATE INDEX IF NOT EXISTS idx_pdf_knowledge_organization_id ON public.pdf_knowledge(organization_id);

-- Some restored environments retain cia_criteria.id as NOT NULL INTEGER but
-- lose its serial default. Repair that before supplementary rows are inserted.
-- A dedicated sequence avoids guessing the name of any orphaned old sequence.
CREATE SEQUENCE IF NOT EXISTS public.cia_criteria_import_id_seq;
ALTER SEQUENCE public.cia_criteria_import_id_seq
  OWNED BY public.cia_criteria.id;
ALTER TABLE public.cia_criteria
  ALTER COLUMN id SET DEFAULT nextval('public.cia_criteria_import_id_seq'::regclass);
SELECT setval(
  'public.cia_criteria_import_id_seq'::regclass,
  COALESCE((SELECT MAX(id) FROM public.cia_criteria), 0) + 1,
  false
);

-- The same repair is needed for pdf_knowledge after restores that preserve
-- the BIGINT column but lose its identity/serial default.
CREATE SEQUENCE IF NOT EXISTS public.pdf_knowledge_import_id_seq;
ALTER SEQUENCE public.pdf_knowledge_import_id_seq
  OWNED BY public.pdf_knowledge.id;
ALTER TABLE public.pdf_knowledge
  ALTER COLUMN id SET DEFAULT nextval('public.pdf_knowledge_import_id_seq'::regclass);
SELECT setval(
  'public.pdf_knowledge_import_id_seq'::regclass,
  COALESCE((SELECT MAX(id) FROM public.pdf_knowledge), 0) + 1,
  false
);

-- ── match_cia_criteria: add org scoping ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.match_cia_criteria(vector, float, int);

CREATE OR REPLACE FUNCTION public.match_cia_criteria (
  query_embedding        VECTOR(1536),
  match_threshold        FLOAT,
  match_count             INT,
  target_organization_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  id              INT,
  category        TEXT,
  theme           TEXT,
  indicator       TEXT,
  sub_indicator   TEXT,
  similarity      FLOAT,
  organization_id UUID
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    cia_criteria.id,
    cia_criteria.category,
    cia_criteria.theme,
    cia_criteria.indicator,
    cia_criteria.sub_indicator,
    1 - (cia_criteria.embedding <=> query_embedding) AS similarity,
    cia_criteria.organization_id
  FROM public.cia_criteria
  WHERE 1 - (cia_criteria.embedding <=> query_embedding) > match_threshold
    AND (cia_criteria.organization_id IS NULL OR cia_criteria.organization_id = target_organization_id)
  ORDER BY cia_criteria.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── match_pdf_knowledge: add org scoping ────────────────────────────────────
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
  organization_id UUID
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    pdf_knowledge.id,
    pdf_knowledge.content,
    pdf_knowledge.section,
    pdf_knowledge.page_start,
    1 - (pdf_knowledge.embedding <=> query_embedding) AS similarity,
    pdf_knowledge.organization_id
  FROM public.pdf_knowledge
  WHERE 1 - (pdf_knowledge.embedding <=> query_embedding) > match_threshold
    AND (pdf_knowledge.organization_id IS NULL OR pdf_knowledge.organization_id = target_organization_id)
  ORDER BY pdf_knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_cia_criteria(vector, float, int, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_pdf_knowledge(vector, float, int, uuid) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- After running this file, ingest BM400's supplementary themes:
--     npx tsx scripts/ingest-framework.ts --org 0bc3db16-d270-42d9-893a-c233a6b83800
--     npx tsx scripts/ingest-bm400-knowledge.ts
-- ─────────────────────────────────────────────────────────────────────────────
