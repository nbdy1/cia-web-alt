/**
 * lib/parent.ts
 *
 * Pure logic for the parent dashboard (no I/O; unit tested in tests/parent.test.ts):
 * pairing codes, sign-up validation, what the AI sees, how its draft is sanitised,
 * sensitivity detection and trend labels.
 *
 * Rules baked in here:
 *  - The AI only sees a digest of STRUCTURED report results, never the interview
 *    transcript and never Mode BK notes.
 *  - Everything the AI writes is a DRAFT. Nothing reaches a parent before the
 *    student's musyrif approves it (enforced in app/actions/parent-review.ts).
 *  - Numbers and trend labels are computed in code, never written by the AI.
 *  - Strength-based: no negative labels, no personality "types", no ranking.
 */

// ─── Pairing codes ──────────────────────────────────────────────────────────

// Must match generate_parent_code() in 20261124_parent_dashboard.sql.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{8}$`);

/** "abcd efgh" / "ABCD-EFGH" -> "ABCD-EFGH"; null when it cannot be a valid code. */
export function normalizeParentCode(input: unknown): string | null {
  const compact = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!CODE_PATTERN.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

/** Normalises, drops invalid entries and duplicates, keeps order. */
export function normalizeParentCodes(inputs: unknown[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of inputs) {
    if (String(raw ?? "").trim() === "") continue;
    const code = normalizeParentCode(raw);
    if (!code) invalid.push(String(raw).trim());
    else if (!valid.includes(code)) valid.push(code);
  }
  return { valid, invalid };
}

export const PARENT_MIN_PASSWORD = 8;
export const PARENT_MAX_CODES = 10;
/** Bump when the consent text changes; parents are asked again. */
export const PARENT_CONSENT_VERSION = "2026-11-24";

export function validateParentCodes(rawCodes: unknown):
  | { valid: true; codes: string[] }
  | { valid: false; error: string } {
  const list = Array.isArray(rawCodes) ? rawCodes : [];
  if (list.length > PARENT_MAX_CODES) return { valid: false, error: "Terlalu banyak kode." };
  const { valid, invalid } = normalizeParentCodes(list);
  if (invalid.length > 0) {
    return { valid: false, error: `Format kode tidak valid: ${invalid.join(", ")}. Kode terdiri dari 8 karakter, contoh K7M2-9QXA.` };
  }
  if (valid.length === 0) return { valid: false, error: "Masukkan minimal satu kode santri." };
  return { valid: true, codes: valid };
}

export function validateParentSignup(input: {
  name: unknown;
  email: unknown;
  password: unknown;
  codes: unknown;
}):
  | { valid: true; name: string; email: string; password: string; codes: string[] }
  | { valid: false; error: string } {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");

  if (!name) return { valid: false, error: "Nama wajib diisi." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: "Email tidak valid." };
  if (password.length < PARENT_MIN_PASSWORD) {
    return { valid: false, error: `Kata sandi minimal ${PARENT_MIN_PASSWORD} karakter.` };
  }
  const codes = validateParentCodes(input.codes);
  if (!codes.valid) return codes;
  return { valid: true, name, email, password, codes: codes.codes };
}

// ─── Content model ──────────────────────────────────────────────────────────

export type Aspect = "karakter" | "mental" | "soft_skill";
export const ASPECTS: { key: Aspect; label: string }[] = [
  { key: "karakter", label: "Karakter" },
  { key: "mental", label: "Mental" },
  { key: "soft_skill", label: "Soft Skill" },
];
export const aspectLabel = (a: string | null | undefined) => ASPECTS.find((x) => x.key === a)?.label ?? "";

export type UpdateKind = "kabar_baik" | "didampingi";
export const KIND_LABEL: Record<UpdateKind, string> = { kabar_baik: "Kabar baik", didampingi: "Sedang didampingi" };

/** One observed behaviour from the CMS, in plain words, tied to its CMS theme. */
export type ObservedItem = { theme: string; text: string };
export type UpdateContent = { text: string; actions: string[]; focus: string | null; duration: string | null; observed?: ObservedItem[] };
export type Trend = { aspect: Aspect; label: TrendLabel; percentage: number | null };
export type SummaryContent = {
  overview: string;
  strengths: string[];
  growth_areas: string[];
  next_focus: string;
  trends: Trend[];
};
export type ProfileContent = { overview: string; strengths: string[]; best_approach: string[] };
export type ContentType = "update" | "summary" | "profile";

export type AnyContent = UpdateContent | SummaryContent | ProfileContent;

const clean = (v: unknown, max = 400) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const list = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : []).map((x) => clean(x, maxLen)).filter(Boolean).slice(0, maxItems);
const prose = (v: unknown, max: number) => String(v ?? "").replace(/[ \t]+/g, " ").trim().slice(0, max);
const isAspect = (v: unknown): v is Aspect => ASPECTS.some((a) => a.key === v);

// ─── Report digest (what the AI sees) ───────────────────────────────────────

export type ParentReportInput = {
  id: string;
  title: string | null;
  created_at: string;
  treatment_plan: unknown;
};

function asPlan(value: unknown): any {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? value : null;
}

/** Aspect most worth talking about: the one with the priority treatment, else most observed. */
export function dominantAspect(plan: unknown): Aspect {
  const p = asPlan(plan);
  const map: Record<string, Aspect> = { karakter: "karakter", mental: "mental", "soft skill": "soft_skill", softskill: "soft_skill" };
  const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[_-]/g, " ").trim();
  const priority = Array.isArray(p?.detailed_assessments)
    ? p.detailed_assessments.find((a: any) => a?.theme && a.theme === p?.treatment?.priority_theme)
    : null;
  if (priority && map[norm(priority.category)]) return map[norm(priority.category)];
  const counts: Record<Aspect, number> = { karakter: 0, mental: 0, soft_skill: 0 };
  for (const a of Array.isArray(p?.detailed_assessments) ? p.detailed_assessments : []) {
    const key = map[norm(a?.category)];
    if (key) counts[key] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Aspect) ?? "karakter";
}

/** Themes that have at least one fulfilled behaviour in this report. */
export function fulfilledThemes(plan: unknown): string[] {
  const p = asPlan(plan);
  return Array.from(new Set(
    (Array.isArray(p?.detailed_assessments) ? p.detailed_assessments : [])
      .filter((a: any) => a?.theme && Array.isArray(a.fulfilled_sub_indicators) && a.fulfilled_sub_indicators.length > 0)
      .map((a: any) => clean(a.theme, 80)),
  ));
}

/** Compact, transcript-free digest of one report. */
export function digestReportForParent(report: ParentReportInput, index: number): string {
  const plan = asPlan(report.treatment_plan);
  const date = new Date(report.created_at).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
  });

  const fulfilled: string[] = [];
  const themes = new Set<string>();
  if (Array.isArray(plan?.detailed_assessments)) {
    for (const a of plan.detailed_assessments) {
      if (a?.theme) themes.add(clean(a.theme, 80));
      if (Array.isArray(a?.fulfilled_sub_indicators)) {
        for (const s of a.fulfilled_sub_indicators.slice(0, 2)) fulfilled.push(`[${clean(a.theme, 80)}] ${clean(s, 140)}`);
      }
    }
  }

  return [
    `Laporan ${index + 1} (${date})`,
    plan?.status_summary ? `Kesimpulan: ${clean(plan.status_summary, 500)}` : null,
    themes.size ? `Tema teramati: ${[...themes].slice(0, 5).join("; ")}` : null,
    fulfilled.length ? `Perilaku positif teramati (CMS, format [Tema] perilaku):\n- ${fulfilled.slice(0, 6).join("\n- ")}` : null,
    plan?.treatment?.priority_theme
      ? `Area fokus berikutnya: ${clean(plan.treatment.priority_theme, 100)}${plan.treatment.priority_indicator ? ` — ${clean(plan.treatment.priority_indicator, 140)}` : ""}`
      : null,
    plan?.treatment?.action_plan ? `Rencana penanganan guru: ${clean(plan.treatment.action_plan, 400)}` : null,
  ].filter(Boolean).join("\n");
}

// ─── Sensitivity ────────────────────────────────────────────────────────────

// Anything that touches conflict, heavy emotion, safety or health must be handled by
// the musyrif talking to the parent directly, never through the feed. This is a
// deliberately over-cautious keyword net on top of the AI's own flag.
const SENSITIVE_PATTERN =
  /konflik|berkelahi|bertengkar|perkelahian|bullying|perundungan|dirundung|mem?bully|menangis|tangis|sedih (berat|mendalam)|depresi|trauma|kekerasan|memukul|mengancam|melukai|menyakiti diri|bunuh diri|kabur|melarikan diri|ingin pulang|rindu berat|sakit (parah|berat)|pelecehan|mencuri|merokok|narkoba|stres berat|cemas berat|panik/i;

export function detectSensitive(...texts: unknown[]): { sensitive: boolean; reason: string | null } {
  const match = texts.map((t) => String(t ?? "")).join(" \n ").match(SENSITIVE_PATTERN);
  return match ? { sensitive: true, reason: `Terdeteksi kata sensitif: "${match[0].toLowerCase()}"` } : { sensitive: false, reason: null };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

const COMMON_RULES = `Aturan umum:
1. Tulis untuk orang tua awam, dalam bahasa Indonesia yang hangat, sederhana, dan jujur. Sapa orang tua dengan "Ayah/Bunda". Tanpa istilah teknis (sub-indikator, pilar, treatment, skor).
2. Anda hanya menerima RINGKASAN terstruktur. Jangan mengarang kejadian, kutipan, tanggal, atau nama orang yang tidak ada di data.
3. Berbasis kekuatan: kabar baik dan pencapaian lebih dulu. DILARANG memakai label negatif, diagnosis, atau "tipe" yang mengunci anak (mis. "anak pemalas", "tipe pemarah"). Area yang dibina ditulis sebagai proses yang sedang berjalan.
4. Jangan menyebut santri lain, jangan membandingkan dengan santri lain, jangan menyebut catatan konseling.
5. Kembalikan HANYA JSON valid.`;

export const CARDS_SYSTEM_PROMPT = `Anda membantu musyrif (pembimbing santri di pesantren) menyiapkan DRAF kartu update untuk orang tua. Musyrif akan membaca dan menyetujui sebelum terkirim.

${COMMON_RULES}

Buat 1 sampai 2 kartu dari laporan TERAKHIR:
- "kabar_baik": pencapaian atau kemajuan nyata (wajib ada jika ada hal positif).
- "didampingi": area yang sedang dibina. Buat HANYA jika ada area fokus berikutnya pada data. Isi "focus" (apa yang difokuskan) dan "duration" (perkiraan lama pendampingan, mis. "2 minggu", berdasar rencana penanganan guru; bila tidak jelas tulis "2 minggu").
Tiap kartu: "text" 2-3 kalimat versi orang tua, "aspect" salah satu dari karakter | mental | soft_skill, dan "actions" 1-2 langkah SEDERHANA yang bisa dilakukan Ayah/Bunda di rumah atau saat menelepon (terjemahkan rencana penanganan guru menjadi aksi sehari-hari; untuk kabar_baik cukup 1 aksi penguat positif).
Untuk kartu "kabar_baik" isi juga "observed": 1-3 perilaku nyata dari bagian "Perilaku positif teramati (CMS)", masing-masing {"theme": nama tema persis seperti di dalam kurung siku, "text": perilaku itu ditulis ulang dalam bahasa sehari-hari yang positif dan sopan untuk orang tua (satu kalimat pendek; jangan menyalin kalimat teknis aslinya, jangan memakai perumpamaan yang merendahkan)}. Hanya pakai perilaku yang benar-benar ada di data. Kartu "didampingi" tidak memakai "observed".
Tambahkan "sensitive": true bila laporan menyiratkan konflik, emosi berat, kesehatan, atau keselamatan; selain itu false. "sensitive_reason" singkat bila true.

Bentuk:
{"cards":[{"kind":"kabar_baik","aspect":"karakter","text":"...","focus":null,"duration":null,"observed":[{"theme":"...","text":"..."}],"actions":["..."]}],"sensitive":false,"sensitive_reason":""}`;

export const PERIOD_SYSTEM_PROMPT = `Anda membantu musyrif menyiapkan DRAF ringkasan periodik dan profil karakter untuk orang tua. Musyrif akan membaca dan menyetujui sebelum terkirim.

${COMMON_RULES}

Bentuk:
{
 "summary": {
   "overview": "1 paragraf (maks 90 kata): apa yang berkembang periode ini",
   "strengths": ["3-4 kekuatan utama, frasa pendek"],
   "growth_areas": ["1-3 area tumbuh, frasa pendek dan positif"],
   "next_focus": "satu kalimat fokus periode berikutnya"
 }
 PROFILE_PART
}`;

const PROFILE_PART = `,
 "profile": {
   "overview": "3-4 kalimat gambaran karakter anak berbasis kekuatan (ini gambaran periode ini, bukan vonis)",
   "strengths": ["3-5 kekuatan karakter"],
   "best_approach": ["2-3 cara terbaik mendampingi anak ini di rumah, berdasar apa yang terlihat efektif; tanpa menyebut 'tipe' kepribadian"]
 }`;

export function periodSystemPrompt(withProfile: boolean) {
  return PERIOD_SYSTEM_PROMPT.replace("PROFILE_PART", withProfile ? PROFILE_PART : "");
}

export function buildCardsUserMessage(firstNameOnly: string, digests: string[]) {
  return `Nama panggilan santri: ${firstNameOnly}\n\nLaporan lama ke baru (yang TERAKHIR dipakai untuk kartu):\n\n${digests.join("\n\n")}`;
}

export function buildPeriodUserMessage(
  firstNameOnly: string,
  periodLabel: string,
  digests: string[],
  homeNotes?: string | null,
) {
  return [
    `Nama panggilan santri: ${firstNameOnly}`,
    `Periode ringkasan: ${periodLabel}`,
    homeNotes ? `Konteks dari rumah (ditulis orang tua):\n${clean(homeNotes, 800)}` : null,
    `Laporan:\n\n${digests.join("\n\n")}`,
  ].filter(Boolean).join("\n\n");
}

// ─── Sanitising AI output ───────────────────────────────────────────────────

export type CardDraft = { kind: UpdateKind; aspect: Aspect; content: UpdateContent };

export function sanitizeCards(raw: any, fallbackAspect: Aspect, allowedThemes?: string[]): { cards: CardDraft[]; sensitive: boolean; reason: string | null } {
  const cards: CardDraft[] = [];
  for (const c of Array.isArray(raw?.cards) ? raw.cards : []) {
    const kind: UpdateKind | null = c?.kind === "kabar_baik" || c?.kind === "didampingi" ? c.kind : null;
    const text = prose(c?.text, 600);
    if (!kind || !text || cards.some((x) => x.kind === kind)) continue;
    let actions = list(c?.actions, 2, 240);
    if (actions.length === 0) actions = [kind === "kabar_baik" ? "Sampaikan rasa bangga Ayah/Bunda kepadanya saat menelepon." : "Tanyakan kabarnya dengan lembut saat menelepon."];
    cards.push({
      kind,
      aspect: isAspect(c?.aspect) ? c.aspect : fallbackAspect,
      content: {
        text,
        actions,
        focus: kind === "didampingi" ? clean(c?.focus, 200) || null : null,
        duration: kind === "didampingi" ? clean(c?.duration, 40) || "2 minggu" : null,
        observed: kind === "kabar_baik" ? sanitizeObserved(c?.observed, allowedThemes) : [],
      },
    });
  }
  if (cards.length === 0) throw new Error("Draf AI untuk kartu update tidak dapat dipakai.");
  return { cards: cards.slice(0, 2), sensitive: raw?.sensitive === true, reason: clean(raw?.sensitive_reason, 200) || null };
}

export function sanitizePeriod(raw: any): { summary: Omit<SummaryContent, "trends">; profile: ProfileContent | null } {
  const s = raw?.summary ?? {};
  const overview = prose(s.overview, 1000);
  if (!overview) throw new Error("Draf ringkasan AI tidak dapat dipakai.");
  const p = raw?.profile;
  const profileOverview = prose(p?.overview, 900);
  return {
    summary: {
      overview,
      strengths: list(s.strengths, 4, 100),
      growth_areas: list(s.growth_areas, 3, 140),
      next_focus: clean(s.next_focus, 300),
    },
    profile: profileOverview
      ? { overview: profileOverview, strengths: list(p.strengths, 5, 100), best_approach: list(p.best_approach, 3, 260) }
      : null,
  };
}

/** Keeps only behaviours tied to a theme that is really in the report (the AI may not invent one). */
export function sanitizeObserved(v: unknown, allowedThemes?: string[]): ObservedItem[] {
  const allowed = allowedThemes?.map((t) => t.toLowerCase());
  return (Array.isArray(v) ? v : [])
    .map((o: any) => ({ theme: clean(o?.theme, 90), text: clean(o?.text, 200) }))
    .filter((o) => o.theme && o.text && (!allowed || allowed.includes(o.theme.toLowerCase())))
    .slice(0, 3);
}

/** Musyrif edits arrive from a form; re-clean them with the same limits. */
export function sanitizeEditedContent(type: ContentType, raw: any): AnyContent {
  if (type === "update") {
    const text = prose(raw?.text, 800);
    if (!text) throw new Error("Teks kartu tidak boleh kosong.");
    return { text, actions: list(raw?.actions, 2, 300), focus: clean(raw?.focus, 200) || null, duration: clean(raw?.duration, 40) || null, observed: sanitizeObserved(raw?.observed) };
  }
  if (type === "summary") {
    const overview = prose(raw?.overview, 1200);
    if (!overview) throw new Error("Ringkasan tidak boleh kosong.");
    return {
      overview,
      strengths: list(raw?.strengths, 6, 120),
      growth_areas: list(raw?.growth_areas, 4, 160),
      next_focus: clean(raw?.next_focus, 300),
      trends: sanitizeTrends(raw?.trends),
    };
  }
  const overview = prose(raw?.overview, 1000);
  if (!overview) throw new Error("Profil tidak boleh kosong.");
  return { overview, strengths: list(raw?.strengths, 6, 120), best_approach: list(raw?.best_approach, 4, 300) };
}

function sanitizeTrends(v: unknown): Trend[] {
  return (Array.isArray(v) ? v : [])
    .filter((t: any) => isAspect(t?.aspect) && TREND_LABELS.includes(t?.label))
    .map((t: any) => ({ aspect: t.aspect, label: t.label, percentage: typeof t.percentage === "number" ? Math.round(t.percentage * 10) / 10 : null }));
}

// ─── Trends (computed in code) ──────────────────────────────────────────────

export const TREND_LABELS = ["Berkembang", "Konsisten", "Perlu Dampingan", "Baru dimulai"] as const;
export type TrendLabel = (typeof TREND_LABELS)[number];

/**
 * Change in Persentase CMS (percentage points) vs the previous period -> label.
 * CMS percentages are small by nature (a few % of hundreds of indicators), so the
 * thresholds are fractions of a point, not whole points. No previous period = "Baru dimulai".
 */
export const TREND_STEP = 0.3;
export function trendLabel(delta: number | null): TrendLabel {
  if (delta === null) return "Baru dimulai";
  if (delta >= TREND_STEP) return "Berkembang";
  if (delta <= -TREND_STEP) return "Perlu Dampingan";
  return "Konsisten";
}

const STAT_KEY: Record<Aspect, string> = { karakter: "karakter", mental: "mental", soft_skill: "soft_skill" };

function pct(plan: unknown, aspect: Aspect): number | null {
  const v = asPlan(plan)?.overall_stats?.[STAT_KEY[aspect]]?.percentage;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Per aspect: the newest percentage inside the period compared with the newest one
 * BEFORE it (previous period only: no ranking, no other students).
 * `reports` may be in any order and may extend before/after the period.
 */
export function computeTrends(
  reports: { created_at: string; treatment_plan: unknown }[],
  period: { startIso: string; endIso: string },
): Trend[] {
  const sorted = [...reports].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const inPeriod = sorted.filter((r) => r.created_at >= period.startIso && r.created_at < period.endIso);
  const before = sorted.filter((r) => r.created_at < period.startIso);
  return ASPECTS.map(({ key }) => {
    const now = inPeriod.map((r) => pct(r.treatment_plan, key)).find((v) => v !== null) ?? null;
    const prev = before.map((r) => pct(r.treatment_plan, key)).find((v) => v !== null) ?? null;
    return {
      aspect: key,
      label: trendLabel(now !== null && prev !== null ? now - prev : null),
      percentage: now === null ? null : Math.max(0, Math.min(100, Math.round(now * 10) / 10)),
    };
  });
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** A held/pending item older than this many days gets a reminder. */
export const REVIEW_REMINDER_DAYS = 3;
export const daysWaiting = (createdAt: string, now = Date.now()) => Math.floor((now - +new Date(createdAt)) / 86_400_000);
