/**
 * lib/data/framework.ts
 *
 * Resolves the CDS framework (Karakter/Mental/Soft Skill themes) for a given
 * organization. Every org gets the base framework (karakter.ts, mental.ts,
 * soft-skill.ts — 40/34/14 themes); an org with a registered supplement in
 * ORG_FRAMEWORK_EXTENSIONS also gets its extra themes appended per category.
 *
 * This is the single place that should be used wherever the *full* framework
 * is needed (RAG ingestion, deterministic scoring lookups, report/recap/rapor
 * rendering, admin stat denominators, the criteria glossary) instead of
 * importing karakterData/mentalData/softSkillData directly — otherwise an
 * org-specific theme silently has nowhere to resolve to outside of RAG.
 */
import { karakterData } from "@/lib/data/karakter";
import { mentalData } from "@/lib/data/mental";
import { softSkillData } from "@/lib/data/soft-skill";
import { bm400Extension } from "@/lib/data/orgs/bm400";

export interface FrameworkTheme {
  id: number;
  title: string;
  explanation: string;
  group?: string;
  quality?: string;
  indicators: { title: string; sub_indicators: string[] }[];
}

export interface FrameworkCategory {
  category: string;
  definition: string;
  themes: FrameworkTheme[];
}

export type Framework = Record<"Karakter" | "Mental" | "Soft Skill", FrameworkCategory>;

const BASE_FRAMEWORK: Framework = {
  Karakter: karakterData,
  Mental: mentalData,
  "Soft Skill": softSkillData,
};

// Keyed by organization_id. Each entry supplies extra themes per category,
// appended on top of the base framework only when resolving for that org.
export const ORG_FRAMEWORK_EXTENSIONS: Record<
  string,
  Partial<Record<"Karakter" | "Mental" | "Soft Skill", { themes: FrameworkTheme[] }>>
> = {
  "0bc3db16-d270-42d9-893a-c233a6b83800": bm400Extension, // SMA Bakti Mulya 400 Jakarta
};

/**
 * Returns the framework applicable to `organizationId`: the base 40/34/14
 * framework, plus that org's registered supplement (if any) appended per
 * category. Orgs with no registered supplement (i.e. everyone but BM400
 * today) get exactly the base framework object back, unchanged.
 */
export function getFrameworkForOrganization(organizationId?: string | null): Framework {
  const extension = organizationId ? ORG_FRAMEWORK_EXTENSIONS[organizationId] : undefined;
  if (!extension) return BASE_FRAMEWORK;

  const merged = {} as Framework;
  for (const key of Object.keys(BASE_FRAMEWORK) as (keyof Framework)[]) {
    const extraThemes = extension[key]?.themes ?? [];
    merged[key] =
      extraThemes.length === 0
        ? BASE_FRAMEWORK[key]
        : { ...BASE_FRAMEWORK[key], themes: [...BASE_FRAMEWORK[key].themes, ...extraThemes] };
  }
  return merged;
}

/** Returns true when a theme belongs to an organization's supplement rather
 * than the shared base framework. */
export function isSupplementaryTheme(
  organizationId: string | null | undefined,
  category: keyof Framework,
  themeTitle: string,
): boolean {
  const extension = organizationId ? ORG_FRAMEWORK_EXTENSIONS[organizationId] : undefined;
  const themes = extension?.[category]?.themes ?? [];
  return themes.some((theme) => theme.title.trim().toLowerCase() === themeTitle.trim().toLowerCase());
}
