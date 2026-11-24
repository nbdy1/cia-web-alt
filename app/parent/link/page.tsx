/** Shown after a first Google sign-in: pair the account with a child using a school code. */
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/parent/ParentClient";
import { Card } from "@/components/parent/ParentShell";
import { createClient } from "@/lib/supabase/server";

export default async function LinkPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/parent/login");
  const { data: memberships } = await db.from("organization_members").select("role").eq("user_id", user.id);
  if ((memberships ?? []).length > 0) redirect("/");
  return (
    <div className="min-h-screen bg-paper p-5 pt-12 font-sans space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Hubungkan dengan anak Anda</h1>
      <p className="text-sm text-slate-500">Masukkan kode santri dari sekolah. Ayah dan Bunda dapat memakai kode yang sama dengan akun masing-masing.</p>
      <Card><ClaimForm /></Card>
    </div>
  );
}
