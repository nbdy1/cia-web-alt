/**
 * Public parent sign-up. A parent creates an account by presenting at least one
 * school-issued pairing code (students.parent_code); more codes may be given for
 * other children at the same or another school.
 *
 * The account is created through the Admin API with email_confirm: true, like
 * every other account in this app (no email verification step). Anyone can call
 * this endpoint, so it (1) refuses to create anything unless every code is valid,
 * (2) never touches an existing account, and (3) is rate limited per IP.
 */
import { NextRequest, NextResponse } from "next/server";
import { validateParentSignup } from "@/lib/parent";
import { linkParentToStudents, lookupParentCodes, parentAdminClient } from "@/lib/parent-link";

// Best effort per-instance limiter; the real protection is the 40-bit code space.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const attempts = new Map<string, number[]>();

function tooManyAttempts(ip: string) {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear();
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooManyAttempts(ip)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const input = validateParentSignup(body ?? {});
  if (!input.valid) return NextResponse.json({ error: input.error }, { status: 400 });

  const lookup = await lookupParentCodes(input.codes);
  if (!lookup.ok) return NextResponse.json({ error: lookup.error }, { status: 400 });

  const { data: created, error: createError } = await parentAdminClient.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, role: "parent" },
  });
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return NextResponse.json(
      {
        error: exists
          ? "Email ini sudah terdaftar. Jika ini akun orang tua Anda, masuk lalu tambahkan kode dari menu Anak. Jika email ini dipakai sebagai guru/staf, daftar dengan email lain (mis. nama+ortu@gmail.com)."
          : "Gagal membuat akun. Coba lagi.",
      },
      { status: exists ? 409 : 500 },
    );
  }

  const userId = created.user.id;
  const orgIds = Array.from(new Set(lookup.students.map((s) => s.organization_id)));

  try {
    const { error: profileError } = await parentAdminClient.from("profiles").upsert(
      { id: userId, name: input.name, email: input.email, role: "parent", organization_id: orgIds[0] },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    await linkParentToStudents(userId, lookup.students);

    // Older databases still auto-enrol new profiles into the default school as
    // staff; a parent must belong only to the schools of their children.
    const { error: staleError } = await parentAdminClient
      .from("organization_members")
      .delete()
      .eq("user_id", userId)
      .not("organization_id", "in", `(${orgIds.join(",")})`);
    if (staleError) throw staleError;
    await parentAdminClient
      .from("organization_members")
      .update({ role: "parent" })
      .eq("user_id", userId)
      .neq("role", "parent");
  } catch (error: any) {
    console.error("[parent signup] failed, rolling back user:", error);
    await parentAdminClient.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Gagal menyelesaikan pendaftaran. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({ success: true, children: lookup.students.map((s) => s.name) });
}
