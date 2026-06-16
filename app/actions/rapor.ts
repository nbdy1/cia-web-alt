/**
 * app/actions/rapor.ts
 *
 * Server action that generates the rapor narrative for a student.
 *
 * KEY DESIGN DECISION — what makes the rapor different from profile_summary:
 *
 *   profile_summary  = 150–200 word internal snapshot for ustadz & AI.
 *                      Built from treatment_plan summaries. Analytical, concise.
 *
 *   rapor narrative  = 400–500 word PARENT-FACING letter from the school.
 *                      Built from the ACTUAL observation transcripts (narrative
 *                      field) so the AI can cite specific, concrete moments the
 *                      teacher recorded — not just the same generalizations that
 *                      appear in the profile. The profile is explicitly given to
 *                      the AI and it is instructed to NOT repeat it.
 *
 * The result is not persisted — generated on demand and reviewed before printing.
 */
"use server";

import { supabase } from "@/lib/supabase";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const CHAT_MODEL = "google/gemini-3-flash-preview";

async function callOpenRouter(systemPrompt: string, userMessage: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content as string;
}

export async function generateRaporNarrative(
  studentId: string,
  period: string
): Promise<{ success: boolean; narrative?: string; error?: string }> {
  try {
    // 1. Fetch student + profile_summary
    const { data: student } = await supabase
      .from("students")
      .select("name, batch, profile_summary")
      .eq("id", studentId)
      .single();

    if (!student) throw new Error("Santri tidak ditemukan");

    // 2. Fetch all reports — crucially, include the raw `narrative` field
    //    (the actual teacher-AI interview transcript) alongside the structured plan.
    const { data: reports } = await supabase
      .from("reports")
      .select("title, created_at, narrative, treatment_plan")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

    if (!reports || reports.length === 0) {
      return {
        success: true,
        narrative: student.profile_summary ?? "Belum ada laporan observasi yang tersimpan untuk santri ini.",
      };
    }

    // 3. Build rich context from actual narratives (transcripts)
    //    We extract: date, a trimmed version of the transcript (to stay within tokens),
    //    plus the structured outcome (priority theme/indicator, fulfilled sub-indicators).
    const reportContext = reports.map((r, i) => {
      let plan = r.treatment_plan;
      if (typeof plan === "string") {
        try { plan = JSON.parse(plan); } catch { /* leave */ }
      }

      const date = new Date(r.created_at).toLocaleDateString("id-ID", {
        year: "numeric", month: "long", day: "numeric",
      });

      // Trim the raw transcript to ~400 chars to stay within token budget
      // but keep enough for the AI to quote specific moments
      const rawNarrative = String(r.narrative ?? "").trim();
      const narrativeExcerpt = rawNarrative.length > 450
        ? rawNarrative.slice(0, 450) + "…"
        : rawNarrative;

      // Structured outcomes from the treatment plan
      const priorityTheme = String(plan?.treatment?.priority_theme ?? "").trim();
      const priorityIndicator = String(plan?.treatment?.priority_indicator ?? "").trim();
      const actionPlan = String(plan?.treatment?.action_plan ?? "").trim();
      const statusSummary = String(plan?.status_summary ?? "").trim();

      // Top fulfilled sub-indicators (concrete achievements)
      const fulfilledSubs: string[] = [];
      if (Array.isArray(plan?.detailed_assessments)) {
        for (const a of plan.detailed_assessments) {
          if (Array.isArray(a?.fulfilled_sub_indicators)) {
            fulfilledSubs.push(...a.fulfilled_sub_indicators.slice(0, 2).map((s: string) => `• ${s}`));
          }
          if (fulfilledSubs.length >= 5) break;
        }
      }

      return [
        `── Laporan ${i + 1}: ${date}${r.title ? ` ("${r.title}")` : ""} ──`,
        narrativeExcerpt ? `[Kutipan observasi ustadz]\n${narrativeExcerpt}` : null,
        statusSummary ? `[Kesimpulan laporan] ${statusSummary}` : null,
        fulfilledSubs.length > 0 ? `[Sub-indikator yang dicapai]\n${fulfilledSubs.join("\n")}` : null,
        priorityTheme ? `[Prioritas berikutnya] ${priorityTheme}${priorityIndicator ? ` → ${priorityIndicator}` : ""}` : null,
        actionPlan ? `[Rencana penanganan] ${actionPlan}` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    // 4. Build the prompt — explicitly give the AI the profile_summary
    //    so it knows exactly what NOT to repeat
    const profileBlock = student.profile_summary
      ? `\n\n⚠️ PROFIL SANTRI (sudah ada di halaman rapor — JANGAN diulang dalam narasi ini):\n"${student.profile_summary}"`
      : "";

    const systemPrompt = `Anda adalah wali kelas di pesantren Sekolah Impian yang menulis NARASI RAPOR untuk orang tua santri.

INSTRUKSI PENTING:
1. Orang tua SUDAH membaca "Profil Santri" di halaman sebelumnya (terlampir di bawah). JANGAN ulangi poin yang sama. Narasi ini harus terasa seperti TAMBAHAN BARU yang memperkaya, bukan parafrase dari profil.
2. Gunakan BUKTI KONKRET dari transkrip observasi yang tersedia — kutip momen spesifik, tanggal, atau perilaku yang teramati. Hindari pernyataan umum seperti "ia adalah santri yang rajin."
3. Tulis dalam 4 paragraf terstruktur:
   — Paragraf 1 (PERJALANAN): Gambaran perkembangan santri dari laporan pertama hingga terakhir. Tunjukkan PERUBAHAN yang terjadi — apa yang berbeda sekarang dibanding awal.
   — Paragraf 2 (PENCAPAIAN KONKRET): 2–3 pencapaian spesifik yang terukur dan teramati langsung oleh ustadz. Sebutkan sub-indikator atau momen yang nyata.
   — Paragraf 3 (TANTANGAN & STRATEGI): Satu area yang sedang dikerjakan, strategi sekolah yang sudah berjalan, dan apa yang sudah terlihat berubah (meski kecil).
   — Paragraf 4 (PERAN ORANG TUA): 2–3 hal konkret yang bisa dilakukan orang tua DI RUMAH — spesifik, praktis, tidak generik.
4. Nada: formal-hangat, seperti surat dari guru kepada orang tua yang saling mempercayai. Gunakan "kami" untuk sekolah, "Bapak/Ibu" untuk orang tua.
5. Panjang: 400–500 kata. HANYA kembalikan teks narasi, tanpa judul, tanpa JSON, tanpa markdown.`;

    const userMessage = `SANTRI: ${student.name} (${student.batch || "Reguler"})
PERIODE RAPOR: ${period}
JUMLAH LAPORAN: ${reports.length}${profileBlock}

RIWAYAT OBSERVASI LENGKAP (${reports.length} laporan, kronologis):
${reportContext}`;

    const narrative = await callOpenRouter(systemPrompt, userMessage);

    return { success: true, narrative: narrative.trim() };
  } catch (err: any) {
    console.error("[Rapor] generateRaporNarrative error:", err);
    return { success: false, error: err.message };
  }
}
