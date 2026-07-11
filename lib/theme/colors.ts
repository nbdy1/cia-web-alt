/**
 * lib/theme/colors.ts
 *
 * Organization branding color scale.
 *
 * Every org picks a single base color (a preset or a custom hex). We expand
 * that into a full 50-950 shade scale — mirroring Tailwind's own palette
 * shape — and publish it as CSS custom properties (--brand-50 .. --brand-950)
 * so existing `*-brand-*` Tailwind utility classes across the app stay themed
 * without touching component code.
 */

export type BrandShade =
  | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export const BRAND_SHADES: BrandShade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export type BrandScale = Record<BrandShade, string>;

export interface ColorPreset {
  id: string;
  label: string;
  scale: BrandScale;
}

// Real Tailwind palettes (v4) for the base color, so presets look exactly
// like the rest of the design system instead of an approximation.
export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "emerald",
    label: "Emerald",
    scale: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
  },
  {
    id: "teal",
    label: "Teal",
    scale: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 900: "#134e4a", 950: "#042f2e" },
  },
  {
    id: "sky",
    label: "Sky",
    scale: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e", 950: "#082f49" },
  },
  {
    id: "blue",
    label: "Blue",
    scale: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
  },
  {
    id: "indigo",
    label: "Indigo",
    scale: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b" },
  },
  {
    id: "violet",
    label: "Violet",
    scale: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
  },
  {
    id: "rose",
    label: "Rose",
    scale: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
  },
  {
    id: "amber",
    label: "Amber",
    scale: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34e", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
  },
  {
    id: "orange",
    label: "Orange",
    scale: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12", 950: "#431407" },
  },
  {
    id: "pink",
    label: "Pink",
    scale: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843", 950: "#500724" },
  },
  {
    id: "slate",
    label: "Slate",
    scale: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
  },
];

// Target lightness (0-100) per shade, tuned to roughly match Tailwind's own
// palette shape so a custom hex still produces a believable-looking scale.
const SHADE_LIGHTNESS: Record<BrandShade, number> = {
  50: 97, 100: 93, 200: 86, 300: 76, 400: 63, 500: 50, 600: 42, 700: 34, 800: 27, 900: 21, 950: 13,
};

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) => Math.round(f(n) * 255).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

/** Expand a single hex color into a full 50-950 brand scale. */
export function generateBrandScale(hex: string): BrandScale {
  const preset = COLOR_PRESETS.find((p) => p.scale[500].toLowerCase() === hex.toLowerCase());
  if (preset) return preset.scale;

  const { h, s } = hexToHsl(hex);
  // Slightly boost saturation at the dark/light extremes so the scale
  // doesn't wash out, mirroring how Tailwind's own scales behave.
  const scale = {} as BrandScale;
  for (const shade of BRAND_SHADES) {
    const l = SHADE_LIGHTNESS[shade];
    const satBoost = shade <= 100 || shade >= 800 ? Math.min(100, s * 1.05) : s;
    scale[shade] = hslToHex(h, satBoost, l);
  }
  return scale;
}

export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Apply a brand scale to the document root as CSS custom properties. */
export function applyBrandScale(scale: BrandScale) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const shade of BRAND_SHADES) {
    root.style.setProperty(`--brand-${shade}`, scale[shade]);
  }
}

export const BRAND_SCALE_STORAGE_KEY = "cia:brand-scale";
