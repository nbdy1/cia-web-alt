import "server-only";
import { redirect } from "next/navigation";
import { getParentSession, hasParentConsent, logParentAccess, type ParentChild } from "@/lib/parent-server";

/**
 * Resolves the signed-in parent and the child selected via ?anak=, makes sure
 * they accepted the current data-use consent, and logs the visit.
 */
export async function loadParentPage(section: string, searchParams?: Promise<{ anak?: string | string[] }>) {
  const session = await getParentSession();
  if (!session) redirect("/");
  if (!(await hasParentConsent(session.userId))) redirect("/parent/consent");
  const raw = (await searchParams)?.anak;
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  const selected: ParentChild | null = session.children.find((c) => c.id === wanted) ?? session.children[0] ?? null;
  await logParentAccess(session.userId, section, selected);
  return { session, selected };
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
