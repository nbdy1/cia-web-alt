/**
 * lib/format.ts — small display helpers (Indonesian locale).
 */

/** Rp1.234.567 */
export const formatIDR = (n: number | null | undefined): string =>
  'Rp' + Math.round(n ?? 0).toLocaleString('id-ID');

/** 1.234.567 */
export const formatNum = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('id-ID');

/** Compact IDR for chart axes: Rp1,2 jt / Rp350 rb */
export const formatIDRShort = (n: number | null | undefined): string => {
  const v = Math.round(n ?? 0);
  if (v >= 1_000_000) return `Rp${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (v >= 1_000) return `Rp${Math.round(v / 1_000).toLocaleString('id-ID')} rb`;
  return `Rp${v}`;
};

/** 0.42 -> "42%" (null-safe; returns "—" when base is 0). */
export const formatPct = (fraction: number | null | undefined): string =>
  fraction == null ? '—' : `${Math.round(fraction * 100)}%`;
