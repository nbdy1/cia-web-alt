import "server-only";

import { cookies } from "next/headers";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/data/language";

export async function getServerAppLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies();
  return normalizeAppLanguage(cookieStore.get("cia-language")?.value);
}
