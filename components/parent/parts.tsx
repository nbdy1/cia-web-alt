import { ASPECTS, aspectLabel, type Trend, type TrendLabel } from "@/lib/parent";
import type { ScoreRow } from "@/lib/parent-server";

const TREND_STYLE: Record<TrendLabel, string> = {
  Berkembang: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Konsisten: "bg-sky-50 text-sky-700 border-sky-100",
  "Perlu Dampingan": "bg-amber-50 text-amber-700 border-amber-100",
  "Baru dimulai": "bg-slate-50 text-slate-500 border-slate-200",
};

/** Label first; the raw percentage is optional and tucked away so it cannot alarm. */
export function TrendList({ trends }: { trends: Trend[] }) {
  return (
    <div className="space-y-2">
      {ASPECTS.map(({ key, label }) => {
        const t = trends.find((x) => x.aspect === key);
        if (!t) return null;
        return (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">{label}</span>
            <span className={`px-3 py-1 rounded-full border text-xs font-bold ${TREND_STYLE[t.label]}`}>{t.label}</span>
          </div>
        );
      })}
      <details className="pt-1">
        <summary className="text-[11px] font-bold text-slate-400 cursor-pointer">Lihat angka Persentase CMS</summary>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          {trends.map((t) => (
            <p key={t.aspect}>{aspectLabel(t.aspect)}: {t.percentage === null ? "—" : `${t.percentage}%`}</p>
          ))}
          <p className="text-slate-400">Persentase perilaku positif yang teramati, bukan nilai ujian. Dibandingkan hanya dengan periode sebelumnya.</p>
        </div>
      </details>
    </div>
  );
}

const SCORE_COLUMN = { nilai_harian: "Harian", nilai_bulanan: "Bulanan", nilai_akhir: "Akhir" } as const;

/** QCB / QMB / QSB for one semester, read-only. */
export function ScoreTable({ rows }: { rows: ScoreRow[] }) {
  const subjects = ["QCB", "QMB", "QSB"].filter((s) => rows.some((r) => r.subject === s));
  const fmt = (n: number | null) => (n === null || n === undefined ? "—" : String(n).replace(".", ","));
  return (
    <div className="space-y-4">
      {subjects.map((subject) => (
        <div key={subject}>
          <p className="text-xs font-bold text-brand-700 mb-1">{subject}</p>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-400">
                <tr>
                  <th className="text-left font-bold p-2">Komponen</th>
                  {Object.values(SCORE_COLUMN).map((c) => <th key={c} className="font-bold p-2">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.subject === subject).map((r) => (
                  <tr key={r.score_type} className="border-t border-slate-50">
                    <td className="p-2 font-bold text-slate-700">{r.score_type}</td>
                    <td className="p-2 text-center">{fmt(r.nilai_harian)}</td>
                    <td className="p-2 text-center">{fmt(r.nilai_bulanan)}</td>
                    <td className="p-2 text-center">{fmt(r.nilai_akhir)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
