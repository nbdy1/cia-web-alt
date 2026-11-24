/** Parent dashboard — "Update perkembangan": feed of musyrif-approved cards. */
import Link from "next/link";
import { Card, EmptyState, ParentShell, ReviewedBy } from "@/components/parent/ParentShell";
import { FeedActions } from "@/components/parent/ParentClient";
import { getFeed } from "@/lib/parent-server";
import { formatDate, loadParentPage } from "@/lib/parent-page";
import { ASPECTS, KIND_LABEL, aspectLabel, firstName } from "@/lib/parent";

type Search = { anak?: string; aspek?: string; periode?: string };
const PERIODS = [{ key: "30", label: "30 hari", days: 30 }, { key: "90", label: "3 bulan", days: 90 }, { key: "all", label: "Semua", days: null }];

export default async function ParentUpdates({ searchParams }: { searchParams?: Promise<Search> }) {
  const { session, selected } = await loadParentPage("update", searchParams);
  const params = (await searchParams) ?? {};
  const aspect = ASPECTS.some((a) => a.key === params.aspek) ? params.aspek! : null;
  const period = PERIODS.find((p) => p.key === params.periode) ?? PERIODS[2];
  const items = selected ? await getFeed(selected, session.userId, { aspect, days: period.days }) : [];
  const href = (next: Partial<Search>) => `/parent/updates?${new URLSearchParams(Object.entries({ anak: selected?.id, aspek: aspect, periode: period.key, ...next }).filter(([, v]) => v) as [string, string][])}`;
  const chip = (active: boolean) => `shrink-0 px-3 py-1.5 rounded-xl border-2 text-xs font-bold ${active ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-slate-200 text-slate-600"}`;

  const body = !selected ? (
    <EmptyState title="Belum ada anak terhubung" text="Buka tab Anak untuk memasukkan kode santri." />
  ) : (
    <>
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto">
          <Link href={href({ aspek: "" })} className={chip(!aspect)}>Semua aspek</Link>
          {ASPECTS.map((a) => <Link key={a.key} href={href({ aspek: a.key })} className={chip(aspect === a.key)}>{a.label}</Link>)}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {PERIODS.map((p) => <Link key={p.key} href={href({ periode: p.key })} className={chip(period.key === p.key)}>{p.label}</Link>)}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Belum ada update" text={`Update untuk ${firstName(selected.name)} muncul setelah musyrif meninjau dan menyetujuinya.`} />
      ) : (
        items.map((u) => (
          <Card key={u.id} className={u.read ? "" : "border-brand-200"}>
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.kind === "kabar_baik" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {KIND_LABEL[u.kind]}
              </span>
              <span className="text-[11px] font-bold text-slate-400">{formatDate(u.publishedAt)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-400">
              {u.aspect && <span>{aspectLabel(u.aspect)}</span>}
              {!u.read && <span className="text-brand-600">· Baru</span>}
              {u.updated && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Diperbarui</span>}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">{u.content.text}</p>

            {u.kind === "didampingi" && u.content.focus && (
              <p className="mt-3 text-sm text-slate-600">
                <span className="font-bold text-amber-600">Fokus: </span>{u.content.focus}
                {u.content.duration && <span className="text-slate-400"> · selama {u.content.duration}</span>}
              </p>
            )}

            {u.content.actions.length > 0 && (
              <div className="mt-3 rounded-2xl bg-brand-50 border border-brand-100 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Yang bisa Ayah/Bunda lakukan</p>
                <ul className="mt-1.5 space-y-1.5">
                  {u.content.actions.map((a) => <li key={a} className="text-sm text-slate-700">• {a}</li>)}
                </ul>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <ReviewedBy name={u.reviewerName} />
              <span className="text-[11px] text-slate-400">Musyrif: {selected.musyrifName ?? "—"}</span>
            </div>

            {u.history.length > 0 && (
              <details className="mt-2">
                <summary className="text-[11px] font-bold text-slate-400 cursor-pointer">Riwayat versi sebelumnya</summary>
                <div className="mt-2 space-y-2">
                  {u.history.map((h) => (
                    <p key={h.version} className="text-xs text-slate-500 border-l-2 border-slate-200 pl-3">
                      <span className="font-bold">{formatDate(h.publishedAt)}:</span> {h.text}
                    </p>
                  ))}
                </div>
              </details>
            )}

            <FeedActions id={u.id} read={u.read} thanked={u.thanked} question={u.question} />
          </Card>
        ))
      )}
    </>
  );

  return <ParentShell parentId={session.userId} parentName={session.name} children={session.children} selected={selected} tab="update" body={body} />;
}
