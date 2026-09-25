"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";

export async function saveBpReportAction(data: { studentId: string; narrative: string; analysis: any }) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("Silakan masuk kembali.");

    const { data: studentRaw, error: studentError } = await db.rpc(
      "get_student_organization_for_report",
      { target_student_id: data.studentId },
    ).maybeSingle();
    if (studentError || !studentRaw) throw studentError ?? new Error("Student not found");
    const organizationId = (studentRaw as { organization_id: string }).organization_id;
    await assertTenantOrganization(db, organizationId);

    const { data: report, error } = await db.from("bp_reports").insert({
      organization_id: organizationId,
      student_id: data.studentId,
      created_by: user.id,
      title: String(data.analysis?.title ?? "Catatan bimbingan"),
      narrative: data.narrative,
      analysis: data.analysis ?? {},
    }).select("id").single();
    if (error) throw error;

    revalidatePath("/bk");
    revalidatePath("/students");
    return { success: true, id: report.id };
  } catch (error: any) {
    console.error("BP report save error:", error);
    return { success: false, error: error.message };
  }
}
