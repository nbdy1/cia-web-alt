/** Rapor CMS for parents: approved summary + profile + semester scores, printable / shareable. */
import { RaporActions } from "@/components/parent/ParentClient";
import { ScoreTable, TrendList } from "@/components/parent/parts";
import { getProfileContent, getScores, getSummaries } from "@/lib/parent-server";
import { formatDate, loadParentPage } from "@/lib/parent-page";
import { firstName, monthLabel } from "@/lib/parent";

export default async function ParentRapor({ searchParams }: { searchParams?: Promise<{ child?: string; period?: string; semester?: string }> }) {
  const { selected } = await loadParentPage("report", searchParams);
  const params = (await searchParams) ?? {};
  if (!selected) return <p className="p-8 text-center text-slate-500">Belum ada anak terhubung.</p>;

  const [summaries, profile, scores] = await Promise.all([getSummaries(selected), getProfileContent(selected), getScores(selected)]);
  const summary = summaries.find((s) => s.periodKey === params.period) ?? summaries[0];
  const semester = scores.find((s) => s.period === params.semester) ?? scores[0];
  const shareText = [
    `Rapor CMS ${selected.name} — ${selected.organizationName}`,
    summary && `${monthLabel(summary.periodKey)}: ${summary.content.overview}`,
    summary?.content.next_focus && `Fokus berikutnya: ${summary.content.next_focus}`,
  ].filter(Boolean).join("\n\n");

  return (
    <div className="min-h-screen bg-white p-5 font-sans space-y-5 print:p-0">
      <RaporActions shareText={shareText} />
      <header className="border-b-2 border-slate-100 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">{selected.organizationName}</p>
        <h1 className="text-xl font-bold text-slate-900">Rapor CMS</h1>
        <p className="text-sm text-slate-600">{selected.name}{selected.className ? ` · Kelas ${selected.className}` : ""}{selected.nis ? ` · NIS ${selected.nis}` : ""}</p>
        <p className="text-xs text-slate-400">Musyrif: {selected.musyrifName ?? "—"} · Dicetak {formatDate(new Date().toISOString())}</p>
      </header>

      {profile && (
        <section>
          <h2 className="font-bold text-slate-800 mb-1">Profil CMS {firstName(selected.name)}</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{profile.content.overview}</p>
          <p className="text-[11px] text-slate-400 mt-1">Gambaran periode ini, bukan vonis.</p>
        </section>
      )}

      {summary && (
        <section className="space-y-3">
          <h2 className="font-bold text-slate-800">Rangkuman {monthLabel(summary.periodKey)}</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{summary.content.overview}</p>
          {summary.content.trends?.length > 0 && <TrendList trends={summary.content.trends} />}
          {summary.content.strengths.length > 0 && <p className="text-sm"><b>Kekuatan utama:</b> {summary.content.strengths.join(", ")}</p>}
          {summary.content.growth_areas.length > 0 && <p className="text-sm"><b>Area tumbuh:</b> {summary.content.growth_areas.join(", ")}</p>}
          {summary.content.next_focus && <p className="text-sm"><b>Fokus berikutnya:</b> {summary.content.next_focus}</p>}
        </section>
      )}

      {semester && (
        <section>
          <h2 className="font-bold text-slate-800 mb-2">Nilai CMS · {semester.period}</h2>
          <ScoreTable rows={semester.rows} />
        </section>
      )}
      <p className="text-[10px] text-slate-400">Dokumen ini hanya memuat ringkasan yang telah ditinjau musyrif.</p>
    </div>
  );
}
