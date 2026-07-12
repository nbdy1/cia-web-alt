/**
 * lib/cia-phases.ts
 *
 * 5-phase CMS (Character / Mental / Soft Skill) classification system.
 *
 * Replaces the old binary Kuat / Lemah system with a graduated 5-phase scale
 * defined by the school's pedagogical framework. The phase is derived from a
 * simple percentage: (count / total) × 100, where:
 *
 *   • At the SUB-INDICATOR level  → count = reports where it was fulfilled,
 *                                    total = total reports for the student.
 *   • At the CATEGORY level       → count = fulfilled sub-indicators (≥1 report),
 *                                    total = all sub-indicators in that category.
 *
 * Phase thresholds:
 *   1. Instingtif / Mentah    →  1 – 20 %
 *   2. Imitasi / Adaptasi     → 21 – 40 %
 *   3. Internalisasi          → 41 – 60 %
 *   4. Aktualisasi            → 61 – 80 %
 *   5. Integrasi / Sempurna   → 81 – 100 %
 *
 * Used by:
 *   app/students/[id]/recap/page.tsx   (screen display)
 *   app/students/[id]/rapor/page.tsx   (screen preview + print HTML)
 */

export interface CIAPhase {
  index: number;          // 1 – 5
  label: string;          // full Indonesian label
  shortLabel: string;     // compact label for badges
  range: string;          // "1–20%"
  description: string;    // one-line pedagogical description
  narrativeLabel: string; // adjective/noun used in "Fase nya adalah '...'"
  narrativeDescription: string; // full sentence after "Yaitu ..."

  // Tailwind classes — for React / screen rendering
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  iconColor: string;

  // Inline CSS values — for print HTML (no Tailwind available)
  printBg: string;
  printBorder: string;
  printText: string;
  printBadgeBg: string;
  printBadgeText: string;
}

export const CIA_PHASES: readonly CIAPhase[] = [
  {
    index: 1,
    label: "Fase Instingtif / Mentah",
    shortLabel: "Instingtif",
    range: "1–20%",
    description: "CMS awal yang masih labil",
    narrativeLabel: "instingtif",
    narrativeDescription: "karakter yang masih bersifat naluriah dan labil — bereaksi berdasarkan insting, bukan nilai yang telah disadari atau dipelajari",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    badgeBg: "bg-slate-500",
    badgeText: "text-white",
    iconColor: "text-slate-400",
    printBg: "#f8fafc",
    printBorder: "#cbd5e1",
    printText: "#334155",
    printBadgeBg: "#64748b",
    printBadgeText: "#ffffff",
  },
  {
    index: 2,
    label: "Fase Imitasi / Adaptasi",
    shortLabel: "Imitasi",
    range: "21–40%",
    description: "CMS lahir karena meniru lingkungan",
    narrativeLabel: "imitatif",
    narrativeDescription: "karakter yang lahir dengan dorongan \"meniru\" atau \"mengadaptasi\" lingkungan sekitar",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    iconColor: "text-amber-400",
    printBg: "#fffbeb",
    printBorder: "#fde68a",
    printText: "#92400e",
    printBadgeBg: "#f59e0b",
    printBadgeText: "#ffffff",
  },
  {
    index: 3,
    label: "Fase Internalisasi",
    shortLabel: "Internalisasi",
    range: "41–60%",
    description: "Nilai-nilai CMS mulai terserap ke dalam diri",
    narrativeLabel: "internalisasi",
    narrativeDescription: "karakter yang mulai terserap ke dalam diri — nilai-nilai mulai dipahami, diyakini, dan dirasakan secara personal",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    badgeBg: "bg-sky-500",
    badgeText: "text-white",
    iconColor: "text-sky-400",
    printBg: "#f0f9ff",
    printBorder: "#bae6fd",
    printText: "#0c4a6e",
    printBadgeBg: "#0ea5e9",
    printBadgeText: "#ffffff",
  },
  {
    index: 4,
    label: "Fase Aktualisasi",
    shortLabel: "Aktualisasi",
    range: "61–80%",
    description: "CMS diimplementasikan secara sadar",
    narrativeLabel: "aktualisasi",
    narrativeDescription: "karakter yang diwujudkan secara sadar — nilai-nilai mulai tercermin dalam tindakan dan keputusan nyata sehari-hari",
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-800",
    badgeBg: "bg-violet-600",
    badgeText: "text-white",
    iconColor: "text-violet-500",
    printBg: "#f5f3ff",
    printBorder: "#ddd6fe",
    printText: "#4c1d95",
    printBadgeBg: "#7c3aed",
    printBadgeText: "#ffffff",
  },
  {
    index: 5,
    label: "Fase Integrasi / Sempurna",
    shortLabel: "Integrasi",
    range: "81–100%",
    description: "CMS menyatu sepenuhnya, keluar secara refleks",
    narrativeLabel: "integratif",
    narrativeDescription: "karakter yang telah menyatu sepenuhnya dengan diri — muncul secara refleks, natural, dan konsisten tanpa perlu usaha sadar",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    badgeBg: "bg-emerald-600",
    badgeText: "text-white",
    iconColor: "text-emerald-500",
    printBg: "#ecfdf5",
    printBorder: "#bbf7d0",
    printText: "#065f46",
    printBadgeBg: "#059669",
    printBadgeText: "#ffffff",
  },
] as const;

/**
 * Returns the CIAPhase for a given count out of a total, or null if count is 0
 * (meaning this sub-indicator / category has never been fulfilled).
 *
 * @param count  - numerator  (fulfilled count, or fulfilled sub-indicator count)
 * @param total  - denominator (total reports, or total sub-indicators)
 */
export function getCIAPhase(count: number, total: number): CIAPhase | null {
  if (total === 0 || count === 0) return null;
  const pct = (count / total) * 100;
  if (pct <= 20) return CIA_PHASES[0];
  if (pct <= 40) return CIA_PHASES[1];
  if (pct <= 60) return CIA_PHASES[2];
  if (pct <= 80) return CIA_PHASES[3];
  return CIA_PHASES[4];
}
