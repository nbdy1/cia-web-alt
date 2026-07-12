/**
 * lib/data/terminology.ts
 *
 * One organization (SMA Bakti Mulya 400) uses "Guru"/"Siswa" instead of the
 * default "Ustadz"/"Santri" terminology used everywhere else in the app.
 * This is intentionally a hardcoded lookup, not a general per-org
 * customization feature — just this one org's display labels.
 *
 * IMPORTANT: this only affects DISPLAY TEXT. It must never be used for the
 * `role` column values ("owner" | "admin" | "ustadz"), the
 * `assigned_ustadz_id` column, or any other internal identifier/comparison —
 * those stay "ustadz" everywhere regardless of org.
 */

export interface Terminology {
  ustadz: string; // "Ustadz" | "Guru"
  ustadzLower: string; // "ustadz" | "guru"
  santri: string; // "Santri" | "Siswa"
  santriLower: string; // "santri" | "siswa"
}

const DEFAULT_TERMINOLOGY: Terminology = {
  ustadz: "Ustadz",
  ustadzLower: "ustadz",
  santri: "Santri",
  santriLower: "santri",
};

const ORG_TERMINOLOGY: Record<string, Terminology> = {
  // SMA Bakti Mulya 400 - Jakarta Selatan
  "0bc3db16-d270-42d9-893a-c233a6b83800": {
    ustadz: "Guru",
    ustadzLower: "guru",
    santri: "Siswa",
    santriLower: "siswa",
  },
  // Limau Bendi School
  "cde16fd0-691d-4343-bacd-19c24cec6041": {
    ustadz: "Guru",
    ustadzLower: "guru",
    santri: "Murid",
    santriLower: "murid",
  },
};

export function getTerminology(organizationId: string | null | undefined): Terminology {
  if (!organizationId) return DEFAULT_TERMINOLOGY;
  return ORG_TERMINOLOGY[organizationId] ?? DEFAULT_TERMINOLOGY;
}
