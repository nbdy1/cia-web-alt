import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";

const admin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export type CodeLookup =
  | { ok: true; students: { id: string; name: string; organization_id: string; code: string }[] }
  | { ok: false; error: string };

/** Resolves normalised codes to students. All codes must exist. */
export async function lookupParentCodes(codes: string[]): Promise<CodeLookup> {
  const { data, error } = await admin
    .from("students")
    .select("id, name, organization_id, parent_code, is_removed")
    .in("parent_code", codes);
  if (error) return { ok: false, error: "Terjadi kesalahan. Coba lagi." };

  const found = (data ?? []).filter((s: any) => !s.is_removed);
  const missing = codes.filter((c) => !found.some((s: any) => s.parent_code === c));
  if (missing.length > 0) {
    // Same message whether the code never existed or was rotated: no oracle for guessing.
    return { ok: false, error: `Kode tidak ditemukan: ${missing.join(", ")}. Periksa kembali atau minta kode baru ke sekolah.` };
  }
  return {
    ok: true,
    students: found.map((s: any) => ({ id: s.id, name: s.name, organization_id: s.organization_id, code: s.parent_code })),
  };
}

/** Pairs a parent with students and makes sure they are a 'parent' member of each school. */
export async function linkParentToStudents(
  parentId: string,
  students: { id: string; organization_id: string }[],
) {
  const orgIds = Array.from(new Set(students.map((s) => s.organization_id)));

  // Never downgrade or touch a staff membership: only add parent rows where none exists.
  const { data: existing } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", parentId)
    .in("organization_id", orgIds);
  const staffOrg = (existing ?? []).find((m: any) => m.role !== "parent");
  if (staffOrg) {
    throw new Error("Akun ini adalah akun staf sekolah dan tidak dapat dipakai sebagai akun orang tua. Gunakan email lain.");
  }
  const have = new Set((existing ?? []).map((m: any) => m.organization_id));
  const missing = orgIds.filter((id) => !have.has(id));
  if (missing.length > 0) {
    const { error } = await admin
      .from("organization_members")
      .insert(missing.map((organization_id) => ({ organization_id, user_id: parentId, role: "parent" })));
    if (error) throw error;
  }

  const { error: linkError } = await admin.from("parent_student_links").upsert(
    students.map((s) => ({ organization_id: s.organization_id, parent_id: parentId, student_id: s.id })),
    { onConflict: "parent_id,student_id", ignoreDuplicates: true },
  );
  if (linkError) throw linkError;
}

export { admin as parentAdminClient };
