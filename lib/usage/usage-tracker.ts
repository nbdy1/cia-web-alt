/**
 * lib/usage/usage-tracker.ts
 *
 * Server-side AI usage metering. Records every LLM / embedding / TTS call into
 * public.ai_usage_events (which a DB trigger rolls up into usage_counters).
 *
 * Design:
 *   - An AsyncLocalStorage context holds the org/user/purpose for the current
 *     server action plus a buffer of usage events.
 *   - Low-level callers (callOpenRouter, embedText) call recordUsage() — cheap,
 *     synchronous, just pushes into the buffer.
 *   - The action wraps its work with withUsageContext(...), so all awaits stay
 *     inside AsyncLocalStorage and buffered rows are inserted once before the
 *     action returns (serverless-safe).
 *
 * All logging is non-fatal: a failure here must never break an assessment.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase-server';
import { computeCostIdr, type UsageProvider } from './rates';

// Must match CIA_ACTIVE_ORG_COOKIE in lib/context/auth-context.tsx.
const ACTIVE_ORG_COOKIE = 'cia_active_organization';
const DEBUG_USAGE = process.env.DEBUG_USAGE === '1';

export type UsagePurpose =
  | 'interview_step'
  | 'finalize'
  | 'profile_summary'
  | 'rapor'
  | 'embedding'
  | 'rerank'
  | 'tts';

interface BufferedEvent {
  provider: UsageProvider;
  model: string | null;
  purpose: UsagePurpose;
  inputTokens: number;
  outputTokens: number;
  charCount: number;
}

interface UsageContext {
  organizationId: string | null;
  userId: string | null;
  studentId: string | null;
  reportId: string | null;
  defaultPurpose: UsagePurpose;
  events: BufferedEvent[];
}

const storage = new AsyncLocalStorage<UsageContext>();

function usageDebug(message: string, meta?: Record<string, unknown>) {
  if (!DEBUG_USAGE) return;
  if (meta) console.log(`[usage] ${message}`, meta);
  else console.log(`[usage] ${message}`);
}

async function resolveUsageContext(opts: {
  purpose: UsagePurpose;
  studentId?: string | null;
  reportId?: string | null;
  organizationId?: string | null;
}): Promise<UsageContext> {
  let organizationId = opts.organizationId ?? null;
  let userId: string | null = null;

  try {
    const db = await getServerSupabase();
    const { data: { user } } = await db.auth.getUser();
    userId = user?.id ?? null;

    if (!organizationId && opts.studentId) {
      const { data: student } = await db
        .from('students')
        .select('organization_id')
        .eq('id', opts.studentId)
        .single();
      organizationId = student?.organization_id ?? null;
    }

    if (!organizationId) {
      const cookieStore = await cookies();
      organizationId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
    }
  } catch (err) {
    console.warn('[usage] failed to resolve usage context:', err);
  }

  const ctx = {
    organizationId,
    userId,
    studentId: opts.studentId ?? null,
    reportId: opts.reportId ?? null,
    defaultPurpose: opts.purpose,
    events: [],
  };

  usageDebug('context resolved', {
    purpose: ctx.defaultPurpose,
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    studentId: ctx.studentId,
    reportId: ctx.reportId,
  });

  return ctx;
}

/**
 * Resolve org + user and install a usage context for the current async flow.
 *
 * Prefer withUsageContext() for new code. This legacy helper only affects the
 * current async execution context; callers that await it may resume outside the
 * store depending on how their async resource was created.
 */
export async function enterUsageContext(opts: {
  purpose: UsagePurpose;
  studentId?: string | null;
  reportId?: string | null;
  organizationId?: string | null;
}): Promise<void> {
  storage.enterWith(await resolveUsageContext(opts));
}

export async function withUsageContext<T>(
  opts: {
    purpose: UsagePurpose;
    studentId?: string | null;
    reportId?: string | null;
    organizationId?: string | null;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = await resolveUsageContext(opts);
  return storage.run(ctx, async () => {
    try {
      return await fn();
    } finally {
      await flushUsage();
    }
  });
}

/** Buffer one usage event against the current context (no-op if none). */
export function recordUsage(event: {
  provider: UsageProvider;
  model?: string | null;
  purpose?: UsagePurpose;
  inputTokens?: number;
  outputTokens?: number;
  charCount?: number;
}): void {
  const ctx = storage.getStore();
  if (!ctx) {
    console.warn('[usage] record skipped: no active context', {
      provider: event.provider,
      model: event.model ?? null,
      purpose: event.purpose ?? null,
    });
    return;
  }
  ctx.events.push({
    provider: event.provider,
    model: event.model ?? null,
    purpose: event.purpose ?? ctx.defaultPurpose,
    inputTokens: event.inputTokens ?? 0,
    outputTokens: event.outputTokens ?? 0,
    charCount: event.charCount ?? 0,
  });
  usageDebug('event buffered', {
    provider: event.provider,
    model: event.model ?? null,
    purpose: event.purpose ?? ctx.defaultPurpose,
    inputTokens: event.inputTokens ?? 0,
    outputTokens: event.outputTokens ?? 0,
    charCount: event.charCount ?? 0,
    bufferedEvents: ctx.events.length,
  });
}

/** Insert all buffered events for the current context. Non-fatal. */
export async function flushUsage(): Promise<void> {
  const ctx = storage.getStore();
  if (!ctx) {
    usageDebug('flush skipped: no active context');
    return;
  }
  if (ctx.events.length === 0) {
    usageDebug('flush skipped: no buffered events', {
      purpose: ctx.defaultPurpose,
      organizationId: ctx.organizationId,
    });
    return;
  }
  if (!ctx.organizationId) {
    console.warn('[usage] flush skipped: missing organization_id', {
      purpose: ctx.defaultPurpose,
      studentId: ctx.studentId,
      bufferedEvents: ctx.events.length,
    });
    return;
  }

  const rows = ctx.events.map((e) => ({
    organization_id: ctx.organizationId,
    user_id: ctx.userId,
    student_id: ctx.studentId,
    report_id: ctx.reportId,
    purpose: e.purpose,
    provider: e.provider,
    model: e.model,
    input_tokens: e.inputTokens,
    output_tokens: e.outputTokens,
    char_count: e.charCount,
    cost_idr: computeCostIdr(e.provider, e.model, e),
  }));
  ctx.events = [];

  try {
    const db = await getServerSupabase();
    const { error } = await db.from('ai_usage_events').insert(rows);
    if (error) console.error('[usage] insert failed:', error.message);
    else usageDebug('events inserted', {
      rows: rows.length,
      organizationId: ctx.organizationId,
      purposes: Array.from(new Set(rows.map((row) => row.purpose))),
      providers: Array.from(new Set(rows.map((row) => row.provider))),
    });
  } catch (err) {
    console.error('[usage] flush failed:', err);
  }
}

/**
 * One-shot logger for actions that make a single external call and don't use
 * the buffered context (e.g. ElevenLabs TTS). Resolves org from the active-org
 * cookie. Non-fatal.
 */
export async function logSingleUsage(event: {
  purpose: UsagePurpose;
  provider: UsageProvider;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  charCount?: number;
  studentId?: string | null;
  reportId?: string | null;
}): Promise<void> {
  try {
    const db = await getServerSupabase();
    const { data: { user } } = await db.auth.getUser();

    let organizationId: string | null = null;
    if (event.studentId) {
      const { data: student } = await db
        .from('students')
        .select('organization_id')
        .eq('id', event.studentId)
        .single();
      organizationId = student?.organization_id ?? null;
    }
    if (!organizationId) {
      const cookieStore = await cookies();
      organizationId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
    }
    if (!organizationId) return;

    const { error } = await db.from('ai_usage_events').insert({
      organization_id: organizationId,
      user_id: user?.id ?? null,
      student_id: event.studentId ?? null,
      report_id: event.reportId ?? null,
      purpose: event.purpose,
      provider: event.provider,
      model: event.model ?? null,
      input_tokens: event.inputTokens ?? 0,
      output_tokens: event.outputTokens ?? 0,
      char_count: event.charCount ?? 0,
      cost_idr: computeCostIdr(event.provider, event.model, event),
    });
    if (error) console.error('[usage] single insert failed:', error.message);
  } catch (err) {
    console.error('[usage] logSingleUsage failed:', err);
  }
}
