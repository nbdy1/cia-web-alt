-- ─────────────────────────────────────────────────────────────────────────────
-- SaaS billing, subscriptions & AI usage metering (Phase 1: schema only).
--
-- Adds: platform_admins, plans (seeded), subscriptions (+ auto-trial trigger),
-- subscription_invoices, ai_usage_rates (seeded), ai_usage_events,
-- usage_counters (trigger-maintained), audit_logs, plus RLS and helper fns.
--
-- Depends on the multi-tenant migration (organizations, organization_members,
-- is_organization_admin / is_organization_member). Idempotent; run in the
-- Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Platform (company) super-admins ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid());
$$;

-- ── Plans catalogue ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id                          TEXT PRIMARY KEY,          -- 'trial','dasar','pro',...
  name                        TEXT NOT NULL,
  price_idr                   INTEGER NOT NULL DEFAULT 0,
  billing_interval            TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month','year')),
  max_reports_per_period      INTEGER,                   -- NULL = unlimited
  max_voice_chars_per_period  INTEGER DEFAULT 0,         -- 0 = voice off, NULL = unlimited
  max_ustadz                  INTEGER,                   -- NULL = unlimited
  max_santri                  INTEGER,                   -- NULL = unlimited
  features                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order                  INTEGER NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case an earlier run created this column as NOT NULL, relax it so
-- Enterprise (unlimited = NULL) is allowed.
ALTER TABLE public.plans ALTER COLUMN max_voice_chars_per_period DROP NOT NULL;

INSERT INTO public.plans
  (id, name, price_idr, max_reports_per_period, max_voice_chars_per_period, max_ustadz, max_santri, features, sort_order)
VALUES
  ('trial',     'Trial',     0,        30,   0,      2,   25,   '{"voice_enabled": false, "models": ["gemini-flash"], "trial_days": 14}',                 0),
  ('dasar',     'Dasar',     199000,   200,  0,      5,   150,  '{"voice_enabled": false, "models": ["gemini-flash"]}',                                   1),
  ('pro',       'Pro',       699000,   600,  60000,  15,  500,  '{"voice_enabled": true,  "models": ["gemini-flash"]}',                                   2),
  ('institusi', 'Institusi', 1799000,  1500, 200000, NULL, 1500, '{"voice_enabled": true,  "models": ["gemini-flash","premium"]}',                        3),
  ('enterprise','Enterprise',0,        NULL, NULL,   NULL, NULL, '{"voice_enabled": true,  "models": ["gemini-flash","premium"], "api_access": true, "custom": true}', 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_idr = EXCLUDED.price_idr,
  max_reports_per_period = EXCLUDED.max_reports_per_period,
  max_voice_chars_per_period = EXCLUDED.max_voice_chars_per_period,
  max_ustadz = EXCLUDED.max_ustadz,
  max_santri = EXCLUDED.max_santri,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ── Subscriptions (one current row per org) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id               TEXT NOT NULL REFERENCES public.plans(id),
  status                TEXT NOT NULL DEFAULT 'trialing'
                          CHECK (status IN ('trialing','active','past_due','suspended','canceled')),
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  trial_end             TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at           TIMESTAMPTZ,
  custom_price_idr      INTEGER,                   -- overrides plan price
  custom_limits         JSONB,                     -- overrides plan limits (Enterprise)
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a trial subscription whenever an organization is created.
CREATE OR REPLACE FUNCTION public.ensure_org_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_end, trial_end)
  VALUES (NEW.id, 'trial', 'trialing', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days')
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_ensure_subscription ON public.organizations;
CREATE TRIGGER organizations_ensure_subscription
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.ensure_org_subscription();

-- Backfill: existing orgs without a subscription get one. The default
-- organization (Sekolah Impian) is put on 'institusi/active' so nothing is
-- capped once enforcement lands; other existing orgs start on trial.
INSERT INTO public.subscriptions (organization_id, plan_id, status, current_period_end, trial_end)
SELECT o.id,
       CASE WHEN o.slug = 'sekolah-impian' THEN 'institusi' ELSE 'trial' END,
       CASE WHEN o.slug = 'sekolah-impian' THEN 'active' ELSE 'trialing' END,
       NOW() + INTERVAL '1 month',
       CASE WHEN o.slug = 'sekolah-impian' THEN NULL ELSE NOW() + INTERVAL '14 days' END
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.organization_id = o.id);

-- ── Invoices (manual billing for now) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id         TEXT REFERENCES public.plans(id),
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  amount_idr      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','void','overdue')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  payment_method  TEXT,          -- 'bank_transfer','va','qris','manual',...
  external_ref    TEXT,          -- gateway id (reserved for Phase 5)
  created_by      UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_org_idx ON public.subscription_invoices (organization_id, issued_at DESC);

-- ── AI usage rates (single source for cost computation) ───────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_rates (
  id                    SERIAL PRIMARY KEY,
  provider              TEXT NOT NULL,     -- 'openrouter','elevenlabs'
  model                 TEXT NOT NULL,
  input_per_mtok_idr    NUMERIC(14,4) DEFAULT 0,   -- per 1,000,000 input tokens
  output_per_mtok_idr   NUMERIC(14,4) DEFAULT 0,   -- per 1,000,000 output tokens
  per_1k_chars_idr      NUMERIC(14,4) DEFAULT 0,   -- per 1,000 characters (TTS)
  effective_from        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, model, effective_from)
);

INSERT INTO public.ai_usage_rates (provider, model, input_per_mtok_idr, output_per_mtok_idr, per_1k_chars_idr)
VALUES
  ('openrouter', 'google/gemini-3-flash-preview',  8975, 53850, 0),
  ('openrouter', 'openai/text-embedding-3-small',   359,     0, 0),
  ('elevenlabs', 'flash-v2.5',                         0,     0, 898)
ON CONFLICT (provider, model, effective_from) DO NOTHING;

-- ── Raw usage log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id              BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_id      UUID,
  report_id       UUID,
  purpose         TEXT NOT NULL,   -- 'interview_step','finalize','profile_summary','rapor','embedding','tts'
  provider        TEXT NOT NULL,   -- 'openrouter','elevenlabs'
  model           TEXT,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  char_count      INTEGER NOT NULL DEFAULT 0,
  cost_idr        NUMERIC(14,4) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'success',
  latency_ms      INTEGER,
  request_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_org_time_idx ON public.ai_usage_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_purpose_idx  ON public.ai_usage_events (organization_id, purpose, created_at DESC);

-- ── Monthly rollup (fast dashboards + quota checks) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_counters (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,             -- first day of the calendar month
  reports_used    INTEGER NOT NULL DEFAULT 0,
  interview_turns INTEGER NOT NULL DEFAULT 0,
  input_tokens    BIGINT  NOT NULL DEFAULT 0,
  output_tokens   BIGINT  NOT NULL DEFAULT 0,
  voice_chars     BIGINT  NOT NULL DEFAULT 0,
  cost_idr        NUMERIC(16,4) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, period_start)
);

CREATE OR REPLACE FUNCTION public.bump_usage_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.usage_counters AS uc
    (organization_id, period_start, reports_used, interview_turns, input_tokens, output_tokens, voice_chars, cost_idr)
  VALUES (
    NEW.organization_id,
    date_trunc('month', NEW.created_at)::date,
    CASE WHEN NEW.purpose = 'finalize'       THEN 1 ELSE 0 END,
    CASE WHEN NEW.purpose = 'interview_step' THEN 1 ELSE 0 END,
    COALESCE(NEW.input_tokens, 0),
    COALESCE(NEW.output_tokens, 0),
    COALESCE(NEW.char_count, 0),
    COALESCE(NEW.cost_idr, 0)
  )
  ON CONFLICT (organization_id, period_start) DO UPDATE SET
    reports_used    = uc.reports_used    + EXCLUDED.reports_used,
    interview_turns = uc.interview_turns + EXCLUDED.interview_turns,
    input_tokens    = uc.input_tokens    + EXCLUDED.input_tokens,
    output_tokens   = uc.output_tokens   + EXCLUDED.output_tokens,
    voice_chars     = uc.voice_chars     + EXCLUDED.voice_chars,
    cost_idr        = uc.cost_idr        + EXCLUDED.cost_idr,
    updated_at      = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usage_events_bump_counters ON public.ai_usage_events;
CREATE TRIGGER usage_events_bump_counters
  AFTER INSERT ON public.ai_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.bump_usage_counters();

-- ── Quota status helper (used by UI + enforcement) ────────────────────────────
CREATE OR REPLACE FUNCTION public.organization_quota_status(target_org UUID)
RETURNS TABLE (
  plan_id        TEXT,
  status         TEXT,
  reports_used   INTEGER,
  reports_limit  INTEGER,
  voice_used     BIGINT,
  voice_limit    INTEGER,
  voice_enabled  BOOLEAN,
  period_start   DATE
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.plan_id,
    s.status,
    COALESCE(uc.reports_used, 0),
    COALESCE((s.custom_limits->>'max_reports_per_period')::int, p.max_reports_per_period),
    COALESCE(uc.voice_chars, 0),
    COALESCE((s.custom_limits->>'max_voice_chars_per_period')::int, p.max_voice_chars_per_period),
    COALESCE((p.features->>'voice_enabled')::boolean, false),
    date_trunc('month', NOW())::date
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  LEFT JOIN public.usage_counters uc
    ON uc.organization_id = s.organization_id
   AND uc.period_start = date_trunc('month', NOW())::date
  WHERE s.organization_id = target_org;
$$;

-- ── Audit log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_time_idx ON public.audit_logs (created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.platform_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_rates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;

-- platform_admins: platform admins only.
DROP POLICY IF EXISTS "platform admins manage platform admins" ON public.platform_admins;
CREATE POLICY "platform admins manage platform admins" ON public.platform_admins
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- plans + rates: readable by everyone signed in (pricing); writable by platform admins.
DROP POLICY IF EXISTS "anyone can read plans" ON public.plans;
CREATE POLICY "anyone can read plans" ON public.plans
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "platform admins write plans" ON public.plans;
CREATE POLICY "platform admins write plans" ON public.plans
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "anyone can read rates" ON public.ai_usage_rates;
CREATE POLICY "anyone can read rates" ON public.ai_usage_rates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "platform admins write rates" ON public.ai_usage_rates;
CREATE POLICY "platform admins write rates" ON public.ai_usage_rates
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- subscriptions: org members read their own; platform admins read/write all.
DROP POLICY IF EXISTS "read own or all subscriptions" ON public.subscriptions;
CREATE POLICY "read own or all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_organization_member(organization_id));
DROP POLICY IF EXISTS "platform admins write subscriptions" ON public.subscriptions;
CREATE POLICY "platform admins write subscriptions" ON public.subscriptions
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- invoices: org admins read their org; platform admins read/write all.
DROP POLICY IF EXISTS "read org or all invoices" ON public.subscription_invoices;
CREATE POLICY "read org or all invoices" ON public.subscription_invoices
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_organization_admin(organization_id));
DROP POLICY IF EXISTS "platform admins write invoices" ON public.subscription_invoices;
CREATE POLICY "platform admins write invoices" ON public.subscription_invoices
  FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- usage events: org admins read their org; platform admins read all; the
-- logged-in user's server action can insert its own org's rows (service role
-- bypasses RLS for background logging).
DROP POLICY IF EXISTS "read org or all usage" ON public.ai_usage_events;
CREATE POLICY "read org or all usage" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_organization_admin(organization_id));
DROP POLICY IF EXISTS "members insert own usage" ON public.ai_usage_events;
CREATE POLICY "members insert own usage" ON public.ai_usage_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_organization_member(organization_id) AND (user_id = auth.uid() OR user_id IS NULL));

-- usage counters: read-only to org admins / platform admins (maintained by trigger).
DROP POLICY IF EXISTS "read org or all counters" ON public.usage_counters;
CREATE POLICY "read org or all counters" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (public.is_platform_admin() OR public.is_organization_admin(organization_id));

-- audit logs: platform admins only.
DROP POLICY IF EXISTS "platform admins read audit" ON public.audit_logs;
CREATE POLICY "platform admins read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_platform_admin());
DROP POLICY IF EXISTS "platform admins write audit" ON public.audit_logs;
CREATE POLICY "platform admins write audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());

-- ── Grants (match Supabase defaults; RLS still governs rows) ───────────────────
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER RUNNING: designate your company's first platform super-admin. Replace
-- the email with the COMPANY admin account (not a pesantren owner):
--
--   INSERT INTO public.platform_admins (user_id, note)
--   SELECT id, 'founder' FROM auth.users WHERE email = 'you@yourcompany.com'
--   ON CONFLICT (user_id) DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────
