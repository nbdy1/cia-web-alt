/**
 * Shared frame for the parent dashboard: school header, child switcher and a
 * bottom tab bar (with an unread badge on "Update"). Server component.
 */
import Link from "next/link";
import { Home, Newspaper, UserRound, Users } from "lucide-react";
import { StudentAvatar } from "@/components/StudentAvatar";
import { ParentSignOut } from "@/components/parent/ParentClient";
import { getUnreadCount, type ParentChild } from "@/lib/parent-server";

export type ParentTab = "summary" | "updates" | "profile" | "children";

const TABS: { key: ParentTab; label: string; href: string; icon: typeof Home }[] = [
  { key: "summary", label: "Rangkuman", href: "/parent", icon: Home },
  { key: "updates", label: "Update", href: "/parent/updates", icon: Newspaper },
  { key: "profile", label: "Profil", href: "/parent/profile", icon: UserRound },
  { key: "children", label: "Anak", href: "/parent/children", icon: Users },
];

export async function ParentShell({
  parentId,
  parentName,
  children: kids,
  selected,
  tab,
  body,
}: {
  parentId: string;
  parentName: string;
  children: ParentChild[];
  selected: ParentChild | null;
  tab: ParentTab;
  body: React.ReactNode;
}) {
  const unread = await getUnreadCount(kids.map((k) => k.id), parentId);
  const q = (href: string, id?: string) => (id ? `${href}?child=${id}` : href);
  return (
    <div className="min-h-screen bg-paper pb-28 font-sans">
      <header className="px-5 pt-10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 truncate">
              {selected?.organizationName || "Portal Orang Tua"}
            </p>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Assalamu&apos;alaikum, {parentName.split(" ")[0]}</h1>
          </div>
          <ParentSignOut />
        </div>

        {kids.length > 1 && tab !== "children" && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {kids.map((child) => {
              const active = child.id === selected?.id;
              return (
                <Link
                  key={child.id}
                  href={q(TABS.find((t) => t.key === tab)!.href, child.id)}
                  className={`shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-2xl border-2 text-xs font-bold ${
                    active ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  <StudentAvatar name={child.name} photoUrl={child.photoUrl} size="sm" colorIndex={0} />
                  {child.name.split(" ")[0]}
                  {unread[child.id] ? <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center">{unread[child.id]}</span> : null}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <main className="px-5 space-y-4">{body}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="w-full max-w-[450px] bg-white/95 backdrop-blur-xl border-t-2 border-slate-100 grid grid-cols-4 px-2 pt-2 pb-2">
          {TABS.map(({ key, label, href, icon: Icon }) => {
            const active = key === tab;
            const badge = key === "updates" && selected ? unread[selected.id] ?? 0 : 0;
            return (
              <Link
                key={key}
                href={q(href, key === "children" ? undefined : selected?.id)}
                className={`relative flex flex-col items-center gap-1 py-2 rounded-xl ${active ? "bg-brand-50 text-brand-700" : "text-slate-400"}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-[28%] min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white border-2 border-slate-100 rounded-[1.6rem] p-5 ${className}`} style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
      {children}
    </section>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="text-center">
      <p className="font-bold text-slate-800">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{text}</p>
    </Card>
  );
}

export function ReviewedBy({ name }: { name: string | null }) {
  return (
    <p className="text-[11px] font-bold text-slate-400">
      ✓ Sudah ditinjau oleh {name ? `Ustadz/Ustadzah ${name}` : "musyrif"}
    </p>
  );
}
