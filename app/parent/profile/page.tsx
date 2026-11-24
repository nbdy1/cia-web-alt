/** Parent dashboard — "Profil santri": identity, strength-based profile, how to support, and home context. */
import { Phone } from "lucide-react";
import { StudentAvatar } from "@/components/StudentAvatar";
import { HomeProfileForm } from "@/components/parent/ParentClient";
import { Card, EmptyState, ParentShell, ReviewedBy } from "@/components/parent/ParentShell";
import { getHomeProfile, getProfileContent } from "@/lib/parent-server";
import { formatDate, loadParentPage } from "@/lib/parent-page";
import { firstName } from "@/lib/parent";

export default async function ParentProfile({ searchParams }: { searchParams?: Promise<{ anak?: string }> }) {
  const { session, selected } = await loadParentPage("profil", searchParams);
  const [profile, home] = selected
    ? await Promise.all([getProfileContent(selected), getHomeProfile(selected, session.userId)])
    : [null, null];
  const phone = selected?.musyrifPhone?.replace(/[^\d+]/g, "") ?? "";
  const wa = phone ? `https://wa.me/${phone.replace(/^\+/, "").replace(/^0/, "62")}` : null;

  const body = !selected || !home ? (
    <EmptyState title="Belum ada anak terhubung" text="Buka tab Anak untuk memasukkan kode santri." />
  ) : (
    <>
      <Card className="flex items-center gap-4">
        <StudentAvatar name={selected.name} photoUrl={selected.photoUrl} size="xl" colorIndex={0} />
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 leading-tight">{selected.name}</h2>
          <p className="text-xs text-slate-500 mt-1">
            {[selected.className && `Kelas ${selected.className}`, selected.nis && `NIS ${selected.nis}`].filter(Boolean).join(" · ") || selected.organizationName}
          </p>
        </div>
      </Card>

      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Musyrif pembimbing</p>
        <p className="font-bold text-slate-800">{selected.musyrifName ?? "Belum ditentukan"}</p>
        {phone ? (
          <div className="mt-3 flex gap-2">
            <a href={`tel:${phone}`} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5"><Phone size={14} /> Telepon</a>
            {wa && <a href={wa} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-bold flex items-center justify-center">WhatsApp</a>}
          </div>
        ) : (
          <p className="mt-1 text-xs text-slate-400">Kontak musyrif belum diisi sekolah.</p>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Profil CMS {firstName(selected.name)}</h2>
        {!profile ? (
          <p className="text-sm text-slate-500">Profil sedang disiapkan musyrif.</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{profile.content.overview}</p>
            {profile.content.strengths.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.content.strengths.map((s) => <span key={s} className="px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-100">{s}</span>)}
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
              Ini gambaran periode ini ({formatDate(profile.publishedAt)}), bukan vonis. Anak terus tumbuh dan gambaran ini akan diperbarui.
            </p>
            <div className="mt-2"><ReviewedBy name={profile.reviewerName} /></div>
          </>
        )}
      </Card>

      {profile && profile.content.best_approach.length > 0 && (
        <Card className="bg-brand-50 border-brand-100">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-700 mb-2">Cara terbaik mendampingi {firstName(selected.name)}</h2>
          <ul className="space-y-2">{profile.content.best_approach.map((a) => <li key={a} className="text-sm text-slate-700 leading-relaxed">• {a}</li>)}</ul>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Profil dari rumah</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Ceritakan tentang {firstName(selected.name)}. Musyrif akan membacanya sebagai konteks tambahan.</p>
        <HomeProfileForm key={selected.id} childId={selected.id} childName={firstName(selected.name)} initial={home} />
      </Card>
    </>
  );

  return <ParentShell parentId={session.userId} parentName={session.name} children={session.children} selected={selected} tab="profil" body={body} />;
}
