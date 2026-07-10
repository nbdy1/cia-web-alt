/**
 * app/actions/scores.ts
 *
 * Server actions for manual score entry (student_scores table).
 *
 * Ustadz can input scores per period (semester) for each student.
 * The score structure mirrors the rapor table in the image:
 *
 *   Subject groups : QCB, QMB, QSB
 *   Row types      : Hafalan, Muhadharah, FR, AR, 3PFB
 *   Columns        : nilai_harian, nilai_bulanan, nilai_akhir
 *
 * Each (student_id, period, subject, score_type) is unique — upsert is used
 * so re-submitting the form overwrites the previous entry.
 */
"use server";

import { getServerSupabase } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type ScoreRow = {
  subject: string;
  score_type: string;
  nilai_harian: number | null;
  nilai_bulanan: number | null;
  nilai_akhir: number | null;
};

/** Fetch all scores for a student in a given period. */
export async function getStudentScores(
  studentId: string,
  period: string,
): Promise<ScoreRow[]> {
  const db = await getServerSupabase();

  const { data, error } = await db
    .from("student_scores")
    .select("subject, score_type, nilai_harian, nilai_bulanan, nilai_akhir")
    .eq("student_id", studentId)
    .eq("period", period);

  if (error) {
    console.error("[Scores] Fetch error:", error);
    return [];
  }
  return (data ?? []) as ScoreRow[];
}

/** Fetch all distinct periods for a student (most recent first). */
export async function getStudentPeriods(studentId: string): Promise<string[]> {
  const db = await getServerSupabase();

  const { data } = await db
    .from("student_scores")
    .select("period")
    .eq("student_id", studentId)
    .order("period", { ascending: false });

  const unique = Array.from(new Set((data ?? []).map((r: any) => r.period)));
  return unique;
}

/** Upsert a batch of score rows for a student+period. */
export async function saveStudentScores(
  studentId: string,
  period: string,
  rows: ScoreRow[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getServerSupabase();

    const upsertRows = rows.map((r) => ({
      student_id: studentId,
      period,
      subject: r.subject,
      score_type: r.score_type,
      nilai_harian: r.nilai_harian ?? null,
      nilai_bulanan: r.nilai_bulanan ?? null,
      nilai_akhir: r.nilai_akhir ?? null,
    }));

    const { error } = await db
      .from("student_scores")
      .upsert(upsertRows, {
        onConflict: "student_id,period,subject,score_type",
      });

    if (error) throw error;

    revalidatePath(`/students/${studentId}/scores`);
    revalidatePath(`/students/${studentId}/rapor`);

    return { success: true };
  } catch (err: any) {
    console.error("[Scores] Save error:", err);
    return { success: false, error: err.message };
  }
}
