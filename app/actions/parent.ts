"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PARENT_CONSENT_VERSION, normalizeParentCode, validateParentCodes } from "@/lib/parent";
import { linkParentToStudents, lookupParentCodes, parentAdminClient } from "@/lib/parent-link";
import { getParentSession } from "@/lib/parent-server";

type Result = { success: boolean; error?: string };

/** A signed-in parent adds another child with a pairing code. */
export async function addChildByCode(rawCode: string): Promise<Result & { childName?: string }> {
  try {
    const session = await getParentSession();
    if (!session) return { success: false, error: "Silakan masuk sebagai orang tua." };

    const code = normalizeParentCode(rawCode);
    if (!code) return { success: false, error: "Format kode tidak valid. Contoh: K7M2-9QXA." };

    const lookup = await lookupParentCodes([code]);
    if (!lookup.ok) return { success: false, error: lookup.error };

    const [student] = lookup.students;
    if (session.children.some((c) => c.id === student.id)) {
      return { success: false, error: `${student.name} sudah terhubung ke akun Anda.` };
    }
    await linkParentToStudents(session.userId, [student]);
    revalidatePath("/parent", "layout");
    return { success: true, childName: student.name };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Gagal menambahkan anak." };
  }
}

/**
 * First step for someone who signed in with Google: they have an account but no
 * school yet. They pair at least one child code, which makes them a parent.
 */
export async function claimParentAccount(rawCodes: string[]): Promise<Result> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { success: false, error: "Silakan masuk terlebih dahulu." };

    const codes = validateParentCodes(rawCodes);
    if (!codes.valid) return { success: false, error: codes.error };
    const lookup = await lookupParentCodes(codes.codes);
    if (!lookup.ok) return { success: false, error: lookup.error };

    const { data: existing } = await parentAdminClient.from("organization_members").select("role").eq("user_id", user.id);
    if ((existing ?? []).some((m: { role: string }) => m.role !== "parent")) {
      return { success: false, error: "Akun ini adalah akun staf sekolah dan tidak dapat dipakai sebagai orang tua." };
    }

    const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || user.email?.split("@")[0] || "Orang Tua";
    const orgIds = Array.from(new Set(lookup.students.map((s) => s.organization_id)));
    const { error: profileError } = await parentAdminClient.from("profiles").upsert(
      { id: user.id, name, email: user.email, role: "parent", organization_id: orgIds[0] },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;
    await linkParentToStudents(user.id, lookup.students);
    revalidatePath("/parent", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Gagal menghubungkan akun." };
  }
}

export async function acceptParentConsent(): Promise<Result> {
  const session = await getParentSession();
  if (!session) return { success: false, error: "Silakan masuk kembali." };
  const { error } = await parentAdminClient
    .from("parent_consents").upsert({ parent_id: session.userId, version: PARENT_CONSENT_VERSION }, { onConflict: "parent_id,version" });
  return error ? { success: false, error: error.message } : { success: true };
}

/** Verifies the content is published and belongs to one of the parent's children. */
async function ownContent(contentId: string) {
  const session = await getParentSession();
  if (!session) throw new Error("Silakan masuk kembali.");
  const { data: row } = await parentAdminClient
    .from("parent_contents").select("id, student_id, organization_id, status").eq("id", contentId).maybeSingle();
  if (!row || row.status !== "published" || !session.children.some((c) => c.id === row.student_id)) {
    throw new Error("Konten tidak ditemukan.");
  }
  return { session, row };
}

export async function markUpdateRead(contentId: string): Promise<Result> {
  try {
    const { session } = await ownContent(contentId);
    await parentAdminClient.from("parent_content_reads").upsert(
      { content_id: contentId, parent_id: session.userId }, { onConflict: "content_id,parent_id", ignoreDuplicates: true },
    );
    revalidatePath("/parent", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

export async function thankForUpdate(contentId: string): Promise<Result> {
  try {
    const { session } = await ownContent(contentId);
    await parentAdminClient.from("parent_content_reads").upsert(
      { content_id: contentId, parent_id: session.userId, reaction: "thanks" }, { onConflict: "content_id,parent_id" },
    );
    revalidatePath("/parent", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/** One question per card to the musyrif. Not a chat. */
export async function askMusyrif(contentId: string, question: string): Promise<Result> {
  try {
    const text = String(question ?? "").trim().slice(0, 500);
    if (text.length < 3) return { success: false, error: "Tulis pertanyaan Anda." };
    const { session, row } = await ownContent(contentId);
    const { error } = await parentAdminClient.from("parent_questions").insert({
      organization_id: row.organization_id, content_id: contentId, student_id: row.student_id, parent_id: session.userId, question: text,
    });
    if (error) return { success: false, error: error.code === "23505" ? "Anda sudah mengirim pertanyaan untuk kartu ini." : error.message };
    revalidatePath("/parent", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

export async function saveHomeProfile(
  childId: string,
  input: { interests: string; habits: string; importantNotes: string },
): Promise<Result> {
  try {
    const session = await getParentSession();
    const child = session?.children.find((c) => c.id === childId);
    if (!session || !child) return { success: false, error: "Anak tidak ditemukan." };
    const cut = (v: string) => String(v ?? "").trim().slice(0, 1000);
    const { error } = await parentAdminClient.from("parent_home_profiles").upsert(
      {
        student_id: childId, parent_id: session.userId, organization_id: child.organizationId,
        interests: cut(input.interests), habits: cut(input.habits), important_notes: cut(input.importantNotes),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,parent_id" },
    );
    if (error) throw error;
    revalidatePath("/parent/profile");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? "Gagal menyimpan." };
  }
}
