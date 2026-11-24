import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import {
  PARENT_CONSENT_VERSION,
  type ProfileContent,
  type SummaryContent,
  type UpdateContent,
  type UpdateKind,
} from "@/lib/parent";

/**
 * Server-side data access for the parent dashboard.
 *
 * Parents have no RLS access to students/reports on purpose. Every read here
 * (1) proves the caller is a parent with a parent_student_links row (read through
 * their own RLS-scoped session), then (2) reads a FIXED set of columns with the
 * service client. Only parent_contents rows with status 'published' (approved by
 * the musyrif) are ever returned. `reports.narrative`, `students.profile_summary`
 * and Mode BK data are never selected.
 */
const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export type ParentChild = {
  id: string;
  name: string;
  nis: string | null;
  className: string | null;
  photoUrl: string | null;
  organizationId: string;
  organizationName: string;
  musyrifName: string | null;
  musyrifPhone: string | null;
  joinedAt: string;
};

export type ParentSession = { userId: string; name: string; children: ParentChild[] };

export async function getParentSession(): Promise<ParentSession | null> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await db
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("role", "parent");
  const parentOrgIds = (memberships ?? []).map((m: { organization_id: string }) => m.organization_id);
  if (parentOrgIds.length === 0) return null;

  const { data: links } = await db
    .from("parent_student_links")
    .select("student_id, organization_id, created_at")
    .eq("parent_id", user.id)
    .in("organization_id", parentOrgIds)
    .order("created_at", { ascending: true });

  const studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id);
  const { data: profile } = await service.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const name = profile?.name ?? (user.user_metadata?.name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? "Orang Tua";
  if (studentIds.length === 0) return { userId: user.id, name, children: [] };

  const { data: students } = await service
    .from("students")
    .select("id, name, nis, class_name, photo_url, organization_id, assigned_ustadz_id, created_at, is_removed")
    .in("id", studentIds);

  const orgIds = Array.from(new Set((students ?? []).map((s) => s.organization_id as string)));
  const ustadzIds = Array.from(new Set((students ?? []).map((s) => s.assigned_ustadz_id).filter(Boolean))) as string[];
  const [{ data: orgs }, { data: ustadz }] = await Promise.all([
    service.from("organizations").select("id, name").in("id", orgIds),
    ustadzIds.length ? service.from("profiles").select("id, name, phone").in("id", ustadzIds) : Promise.resolve({ data: [] as { id: string; name: string; phone: string | null }[] }),
  ]);
  const orgName = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]));
  const ustadzById = new Map((ustadz ?? []).map((u) => [u.id, u]));

  const children: ParentChild[] = [];
  for (const link of links ?? []) {
    const s = (students ?? []).find((x) => x.id === link.student_id);
    if (!s || s.is_removed) continue;
    const musyrif = s.assigned_ustadz_id ? ustadzById.get(s.assigned_ustadz_id) : null;
    // A parent on one school's subdomain only sees that school's children.
    try {
      await assertTenantOrganization(db, s.organization_id);
    } catch {
      continue;
    }
    children.push({
      id: s.id, name: s.name, nis: s.nis ?? null, className: s.class_name ?? null, photoUrl: s.photo_url ?? null,
      organizationId: s.organization_id, organizationName: orgName.get(s.organization_id) ?? "",
      musyrifName: musyrif?.name ?? null, musyrifPhone: musyrif?.phone ?? null, joinedAt: s.created_at,
    });
  }
  return { userId: user.id, name, children };
}

export async function hasParentConsent(parentId: string) {
  const { data } = await service
    .from("parent_consents").select("parent_id").eq("parent_id", parentId).eq("version", PARENT_CONSENT_VERSION).maybeSingle();
  return !!data;
}

/** Access log (privacy). Never blocks the page. */
export async function logParentAccess(parentId: string, section: string, child?: ParentChild | null) {
  try {
    await service.from("parent_access_log").insert({
      parent_id: parentId, student_id: child?.id ?? null, organization_id: child?.organizationId ?? null, section,
    });
  } catch {
    /* logging must never break the dashboard */
  }
}

// ─── Feed ───────────────────────────────────────────────────────────────────

export type FeedItem = {
  id: string;
  kind: UpdateKind;
  aspect: string | null;
  content: UpdateContent;
  publishedAt: string;
  version: number;
  updated: boolean;
  history: { version: number; publishedAt: string; text: string }[];
  reviewerName: string | null;
  read: boolean;
  thanked: boolean;
  question: { text: string; answer: string | null } | null;
};

const asContent = <T,>(v: unknown) => v as T;

async function reviewerNames(ids: (string | null)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await service.from("profiles").select("id, name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}

export async function getFeed(
  child: ParentChild,
  parentId: string,
  filter: { aspect?: string | null; days?: number | null } = {},
): Promise<FeedItem[]> {
  let query = service
    .from("parent_contents")
    .select("id, chain_id, kind, aspect, content, version, published_at, reviewer_id")
    .eq("student_id", child.id)
    .eq("content_type", "update")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  if (filter.aspect) query = query.eq("aspect", filter.aspect);
  if (filter.days) query = query.gte("published_at", new Date(Date.now() - filter.days * 86_400_000).toISOString());
  const { data: rows } = await query;
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);
  const chains = rows.filter((r) => r.version > 1).map((r) => r.chain_id as string);
  const [names, { data: reads }, { data: questions }, { data: old }] = await Promise.all([
    reviewerNames(rows.map((r) => r.reviewer_id)),
    service.from("parent_content_reads").select("content_id, reaction").eq("parent_id", parentId).in("content_id", ids),
    service.from("parent_questions").select("content_id, question, answer").eq("parent_id", parentId).in("content_id", ids),
    chains.length
      ? service.from("parent_contents").select("chain_id, version, content, published_at").in("chain_id", chains).eq("status", "superseded").order("version", { ascending: false })
      : Promise.resolve({ data: [] as { chain_id: string; version: number; content: unknown; published_at: string }[] }),
  ]);
  const readMap = new Map((reads ?? []).map((r) => [r.content_id as string, r.reaction as string | null]));
  const questionMap = new Map((questions ?? []).map((q) => [q.content_id as string, q]));

  return rows.map((r): FeedItem => ({
    id: r.id, kind: r.kind, aspect: r.aspect, content: asContent<UpdateContent>(r.content),
    publishedAt: r.published_at, version: r.version, updated: r.version > 1,
    history: (old ?? []).filter((o) => o.chain_id === r.chain_id)
      .map((o) => ({ version: o.version, publishedAt: o.published_at, text: asContent<UpdateContent>(o.content).text })),
    reviewerName: r.reviewer_id ? names.get(r.reviewer_id) ?? null : null,
    read: readMap.has(r.id), thanked: readMap.get(r.id) === "thanks",
    question: questionMap.has(r.id) ? { text: questionMap.get(r.id)!.question, answer: questionMap.get(r.id)!.answer } : null,
  }));
}

export async function getUnreadCount(childIds: string[], parentId: string): Promise<Record<string, number>> {
  if (childIds.length === 0) return {};
  const { data: rows } = await service
    .from("parent_contents").select("id, student_id").in("student_id", childIds).eq("content_type", "update").eq("status", "published");
  const ids = (rows ?? []).map((r) => r.id as string);
  const { data: reads } = ids.length
    ? await service.from("parent_content_reads").select("content_id").eq("parent_id", parentId).in("content_id", ids)
    : { data: [] as { content_id: string }[] };
  const readSet = new Set((reads ?? []).map((r) => r.content_id));
  const out: Record<string, number> = {};
  for (const r of rows ?? []) if (!readSet.has(r.id)) out[r.student_id] = (out[r.student_id] ?? 0) + 1;
  return out;
}

// ─── Summary, profile, scores, home profile ─────────────────────────────────

export type PublishedSummary = { periodKey: string; content: SummaryContent; publishedAt: string; reviewerName: string | null; updated: boolean };

export async function getSummaries(child: ParentChild): Promise<PublishedSummary[]> {
  const { data: rows } = await service
    .from("parent_contents")
    .select("period_key, content, published_at, reviewer_id, version")
    .eq("student_id", child.id).eq("content_type", "summary").eq("status", "published")
    .order("period_key", { ascending: false }).limit(12);
  const names = await reviewerNames((rows ?? []).map((r) => r.reviewer_id));
  return (rows ?? []).map((r) => ({
    periodKey: r.period_key as string, content: asContent<SummaryContent>(r.content), publishedAt: r.published_at,
    reviewerName: r.reviewer_id ? names.get(r.reviewer_id) ?? null : null, updated: r.version > 1,
  }));
}

export async function getProfileContent(child: ParentChild) {
  const { data: row } = await service
    .from("parent_contents")
    .select("content, published_at, reviewer_id")
    .eq("student_id", child.id).eq("content_type", "profile").eq("status", "published")
    .order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (!row) return null;
  const names = await reviewerNames([row.reviewer_id]);
  return { content: asContent<ProfileContent>(row.content), publishedAt: row.published_at as string, reviewerName: row.reviewer_id ? names.get(row.reviewer_id) ?? null : null };
}

export type ScoreRow = { subject: string; score_type: string; nilai_harian: number | null; nilai_bulanan: number | null; nilai_akhir: number | null };

/** QCB / QMB / QSB per semester, entered by the teacher. Read-only. */
export async function getScores(child: ParentChild) {
  const { data } = await service
    .from("student_scores")
    .select("period, subject, score_type, nilai_harian, nilai_bulanan, nilai_akhir")
    .eq("student_id", child.id).order("period", { ascending: false });
  const byPeriod = new Map<string, ScoreRow[]>();
  for (const r of data ?? []) {
    const list = byPeriod.get(r.period as string) ?? [];
    list.push(r as ScoreRow);
    byPeriod.set(r.period as string, list);
  }
  return Array.from(byPeriod, ([period, rows]) => ({ period, rows }));
}

export async function getHomeProfile(child: ParentChild, parentId: string) {
  const { data } = await service
    .from("parent_home_profiles").select("interests, habits, important_notes").eq("student_id", child.id).eq("parent_id", parentId).maybeSingle();
  return { interests: data?.interests ?? "", habits: data?.habits ?? "", importantNotes: data?.important_notes ?? "" };
}
