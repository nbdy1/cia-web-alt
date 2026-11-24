/**
 * Parent dashboard — "Rangkuman perkembangan": the periodic (monthly) summary the
 * musyrif approved, with trend labels versus the previous period, QCB/QMB/QSB
 * for the semester (read-only) and a link to the Rapor CMS.
 */
import Link from "next/link";
import { FileText, Sparkles, Sprout, Target } from "lucide-react";
import { Card, EmptyState, ParentShell, ReviewedBy } from "@/components/parent/ParentShell";
import { ScoreTable, TrendList } from "@/components/parent/parts";
import { getScores, getSummaries } from "@/lib/parent-server";
import { formatDate, loadParentPage } from "@/lib/parent-page";
import { firstName, monthLabel } from "@/lib/parent";

type Search = { anak?: string; periode?: string; semester?: string };

export default async function ParentHome({ searchParams }: { searchParams?: Promise<Search> }) {
  const { session, selected } = await loadParentPage("rangkuman", searchParams);
  const params = (await searchParams) ?? {};
  const [summaries, scores] = selected ? await Promise.all([getSummaries(selected), getScores(selected)]) : [[], []];
  const summary = summaries.find((s) => s.periodKey === params.periode) ?? summaries[0];
  const semester = scores.find((s) => s.period === params.semester) ?? scores[0];
  const q = (extra: Record<string, string>) => `/parent?${new URLSearchParams({ anak: selected?.id ?? "", ...extra })}`;

  const body = !selected ? (
    <EmptyState title="Belum ada anak terhubung" text="Buka tab Anak untuk memasukkan kode santri dari sekolah." />
  ) : (
    <>
      {!summary ? (
        <EmptyState
          title={`Rangkuman ${firstName(selected.name)} sedang disiapkan`}
          text="Rangkuman muncul setelah musyrif menyiapkan dan menyetujuinya. Biasanya setelah pengamatan pertama bulan ini."
        />
      ) : (
        <>
          {summaries.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {summaries.map((s) => (
                <Link key={s.periodKey} href={q({ periode: s.periodKey })}
                  className={`shrink-0 px-3 py-1.5 rounded-xl border-2 text-xs font-bold ${s.periodKey === summary.periodKey ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-slate-200 text-slate-600"}`}>
                  {monthLabel(s.periodKey)}
                </Link>
              ))}
            </div>
          )}

          <Card>
            <div className="flex items-center gap-2 text-brand-700 mb-2">
              <Sparkles size={16} />
              <h2 className="text-sm font-bold uppercase tracking-wider">Rangkuman {monthLabel(summary.periodKey)}</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{summary.content.overview}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <ReviewedBy name={summary.reviewerName} />
              {summary.updated && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">Diperbarui</span>}
            </div>
          </Card>

          {summary.content.trends?.length > 0 && (
            <Card>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Perkembangan per aspek</h2>
              <TrendList trends={summary.content.trends} />
              <p className="mt-3 text-[11px] text-slate-400">Dibandingkan dengan periode sebelumnya, bukan dengan santri lain.</p>
            </Card>
          )}

          {summary.content.strengths.length > 0 && (
            <Card>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Kekuatan utama</h2>
              <div className="flex flex-wrap gap-2">
                {summary.content.strengths.map((s) => (
                  <span key={s} className="px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-100">{s}</span>
                ))}
              </div>
            </Card>
          )}

          {summary.content.growth_areas.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 text-amber-600 mb-3"><Sprout size={16} /><h2 className="text-sm font-bold uppercase tracking-wider">Area tumbuh</h2></div>
              <ul className="space-y-2">{summary.content.growth_areas.map((s) => <li key={s} className="text-sm text-slate-700">• {s}</li>)}</ul>
            </Card>
          )}

          {summary.content.next_focus && (
            <Card className="bg-brand-50 border-brand-100">
              <div className="flex items-center gap-2 text-brand-700 mb-2"><Target size={16} /><h2 className="text-sm font-bold uppercase tracking-wider">Fokus berikutnya</h2></div>
              <p className="text-sm text-slate-700 leading-relaxed">{summary.content.next_focus}</p>
            </Card>
          )}
        </>
      )}

      {semester && (
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Nilai CMS · QCB / QMB / QSB</h2>
          {scores.length > 1 && (
            <div className="flex gap-2 overflow-x-auto py-2">
              {scores.map((s) => (
                <Link key={s.period} href={q({ semester: s.period })}
                  className={`shrink-0 px-3 py-1 rounded-xl border-2 text-[11px] font-bold ${s.period === semester.period ? "bg-slate-800 border-slate-800 text-white" : "border-slate-200 text-slate-500"}`}>
                  {s.period}
                </Link>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400 mb-3">{semester.period} · hanya untuk dibaca</p>
          <ScoreTable rows={semester.rows} />
        </Card>
      )}

      <Link href={`/parent/rapor?${new URLSearchParams({ anak: selected.id, ...(summary ? { periode: summary.periodKey } : {}), ...(semester ? { semester: semester.period } : {}) })}`}
        className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-700">
        <FileText size={16} /> Rapor CMS (unduh / bagikan)
      </Link>
      {summary && <p className="text-center text-[10px] text-slate-400">Disetujui {formatDate(summary.publishedAt)}</p>}
    </>
  );

  return <ParentShell parentId={session.userId} parentName={session.name} children={session.children} selected={selected} tab="ringkasan" body={body} />;
}
