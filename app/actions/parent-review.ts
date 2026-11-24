"use server";

/**
 * app/actions/parent-review.ts
 *
 * The approval gate for the parent dashboard. A parent can only ever read rows
 * with status 'published', and only these actions create such rows. Each action
 * checks that the caller is the student's musyrif (or an organization admin)
 * through the same database function the RLS policies use, and writes an audit
 * entry with what changed from the AI draft.
 */
import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { sanitizeEditedContent, type ContentType } from "@/lib/parent";
import { generateParentDraftsForReport } from "@/app/actions/parent-updates";

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Result = { success: boolean; error?: string };

async function authorizeStudent(studentId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");
  const { data: student } = await admin.from("students").select("organization_id").eq("id", studentId).single();
  if (!student) throw new Error("Santri tidak ditemukan.");
  await assertTenantOrganization(db, student.organization_id);
  const { data: allowed } = await db.rpc("is_assigned_student", { target_student_id: studentId });
  if (!allowed) throw new Error("Hanya musyrif santri ini atau admin yang dapat meninjau.");
  return { userId: user.id, organizationId: student.organization_id as string };
}

async function loadRow(id: string) {
  const { data, error } = await admin.from("parent_contents").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Konten tidak ditemukan.");
  return data;
}

async function audit(contentId: string, orgId: string, actor: string, action: string, changes: unknown = {}) {
  await admin.from("parent_content_audit").insert({ content_id: contentId, organization_id: orgId, actor_id: actor, action, changes });
}

const wrap = async (fn: () => Promise<void>): Promise<Result> => {
  try {
    await fn();
    revalidatePath("/parent", "layout");
    revalidatePath("/parent-review");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Gagal." };
  }
};

async function publish(row: any, userId: string, content: unknown, edited: boolean) {
  // The previous version of the same item stays as history.
  if (row.version > 1) {
    await admin
      .from("parent_contents")
      .update({ status: "superseded" })
      .eq("chain_id", row.chain_id)
      .eq("status", "published")
      .neq("id", row.id);
  }
  const now = new Date().toISOString();
  const { error } = await admin
    .from("parent_contents")
    .update({ status: "published", content, reviewer_id: userId, reviewed_at: now, published_at: now })
    .eq("id", row.id);
  if (error) throw error;
  await audit(row.id, row.organization_id, userId, edited ? "edit_approve" : "approve", edited ? { before: row.content, after: content } : {});
}

/**
 * "Setujui & kirim". `edited` is the musyrif's version of the text (optional).
 * Sensitive items need `contactedParent`: the musyrif speaks to the parent first.
 */
export async function approveContent(id: string, edited?: unknown, contactedParent = false): Promise<Result> {
  return wrap(async () => {
    const row = await loadRow(id);
    const { userId } = await authorizeStudent(row.student_id);
    if (row.status !== "pending" && row.status !== "held") throw new Error("Konten ini sudah diproses.");
    if (row.sensitive && !contactedParent) {
      throw new Error("Konten sensitif: hubungi wali langsung terlebih dahulu, lalu centang konfirmasi.");
    }
    const content = edited ? sanitizeEditedContent(row.content_type as ContentType, edited) : row.content;
    await publish(row, userId, content, !!edited && JSON.stringify(content) !== JSON.stringify(row.draft));
  });
}

/** Bulk approve: only positive, non-sensitive update cards. Everything else is opened one by one. */
export async function bulkApprovePositive(ids: string[]): Promise<Result & { approved?: number; skipped?: number }> {
  let approved = 0;
  let skipped = 0;
  const result = await wrap(async () => {
    for (const id of ids.slice(0, 100)) {
      const row = await loadRow(id);
      const eligible = row.content_type === "update" && row.kind === "kabar_baik" && !row.sensitive && (row.status === "pending" || row.status === "held");
      if (!eligible) { skipped++; continue; }
      const { userId } = await authorizeStudent(row.student_id);
      await publish(row, userId, row.content, false);
      approved++;
    }
  });
  return { ...result, approved, skipped };
}

export async function holdContent(id: string, note?: string): Promise<Result> {
  return wrap(async () => {
    const row = await loadRow(id);
    const { userId } = await authorizeStudent(row.student_id);
    if (row.status !== "pending") throw new Error("Hanya draf yang menunggu yang dapat ditahan.");
    await admin.from("parent_contents").update({ status: "held" }).eq("id", id);
    await audit(id, row.organization_id, userId, "hold", { note: String(note ?? "").slice(0, 300) });
  });
}

export async function releaseContent(id: string): Promise<Result> {
  return wrap(async () => {
    const row = await loadRow(id);
    const { userId } = await authorizeStudent(row.student_id);
    if (row.status !== "held") throw new Error("Konten tidak sedang ditahan.");
    await admin.from("parent_contents").update({ status: "pending" }).eq("id", id);
    await audit(id, row.organization_id, userId, "release");
  });
}

/** Correct something already sent: becomes a new version (history kept, parents see "diperbarui"). */
export async function correctPublished(id: string, edited: unknown): Promise<Result> {
  return wrap(async () => {
    const row = await loadRow(id);
    const { userId } = await authorizeStudent(row.student_id);
    if (row.status !== "published") throw new Error("Hanya konten yang sudah terkirim yang dapat dikoreksi.");
    const content = sanitizeEditedContent(row.content_type as ContentType, edited);
    const now = new Date().toISOString();
    await admin.from("parent_contents").update({ status: "superseded" }).eq("id", id);
    const { data, error } = await admin
      .from("parent_contents")
      .insert({
        organization_id: row.organization_id, student_id: row.student_id, chain_id: row.chain_id, version: row.version + 1,
        content_type: row.content_type, kind: row.kind, aspect: row.aspect, report_id: row.report_id, period_key: row.period_key,
        draft: row.draft, content, status: "published", sensitive: row.sensitive,
        reviewer_id: userId, reviewed_at: now, published_at: now, model_used: row.model_used,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Gagal menyimpan koreksi.");
    await audit(data.id, row.organization_id, userId, "correct", { before: row.content, after: content });
  });
}

/** Pull a published item back from parents (it returns to the held queue). */
export async function withdrawContent(id: string): Promise<Result> {
  return wrap(async () => {
    const row = await loadRow(id);
    const { userId } = await authorizeStudent(row.student_id);
    if (row.status !== "published") throw new Error("Konten belum terkirim.");
    await admin.from("parent_contents").update({ status: "held" }).eq("id", id);
    await audit(id, row.organization_id, userId, "hide");
  });
}

/** Make a fresh draft set from the student's latest report (profile included). */
export async function regenerateDrafts(studentId: string): Promise<Result> {
  return wrap(async () => {
    await authorizeStudent(studentId);
    const { data: latest } = await admin
      .from("reports").select("id").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!latest) throw new Error("Santri ini belum punya laporan.");
    const result = await generateParentDraftsForReport(latest.id, { forceProfile: true });
    if (!result.success) throw new Error(result.error ?? "Gagal membuat draf.");
  });
}

export async function answerParentQuestion(questionId: string, answer: string): Promise<Result> {
  return wrap(async () => {
    const text = String(answer ?? "").trim().slice(0, 1000);
    if (!text) throw new Error("Jawaban tidak boleh kosong.");
    const { data: q } = await admin.from("parent_questions").select("student_id").eq("id", questionId).single();
    if (!q) throw new Error("Pertanyaan tidak ditemukan.");
    const { userId } = await authorizeStudent(q.student_id);
    await admin.from("parent_questions").update({ answer: text, answered_by: userId, answered_at: new Date().toISOString() }).eq("id", questionId);
  });
}

/** Admin/musyrif: set the class shown on the parent's child profile. */
export async function setStudentClass(studentId: string, className: string): Promise<Result> {
  return wrap(async () => {
    await authorizeStudent(studentId);
    const { error } = await admin.from("students").update({ class_name: className.trim().slice(0, 40) || null }).eq("id", studentId);
    if (error) throw error;
  });
}

/** Staff: phone shown to parents as the musyrif's contact. Own profile only. */
export async function setMyContactPhone(phone: string): Promise<Result> {
  return wrap(async () => {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("Silakan masuk kembali.");
    const cleaned = phone.replace(/[^\d+]/g, "").slice(0, 20);
    const { error } = await admin.from("profiles").update({ phone: cleaned || null }).eq("id", user.id);
    if (error) throw error;
  });
}
