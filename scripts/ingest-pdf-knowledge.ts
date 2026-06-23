/**
 * scripts/ingest-pdf-knowledge.ts
 *
 * Chunks and embeds the NON-CRITERIA sections of the full KMS PDF
 * (everything EXCEPT pages 75–253, which are already in cia_criteria).
 *
 * What gets indexed:
 *   Pages   4– 74 : Dasar Teori (Puzzle Kesuksesan, fondasi KMS)
 *   Pages 254–258 : Cara Menanamkan KMS Quranik (5 langkah)
 *   Pages 259–596 : 25 Simulasi Situasi (kegagalan, konflik, dll.)
 *
 * REQUIREMENTS:
 *   1. Install the PDF parser (one-time):
 *        npm install --save-dev pdf-parse @types/pdf-parse
 *   2. Make sure OPENROUTER_API_KEY and NEXT_PUBLIC_SUPABASE_URL are in .env.local
 *      (SUPABASE_SERVICE_ROLE_KEY is preferred; anon key also works for inserts
 *       if RLS allows it)
 *   3. Run the SQL migration first:
 *        Supabase → SQL Editor → paste scripts/add_pdf_knowledge.sql → Run
 *   4. Run this script:
 *        npx tsx scripts/ingest-pdf-knowledge.ts --pdf /path/to/full-597-page.pdf
 *
 * Options:
 *   --pdf       <path>   Path to the full PDF  [REQUIRED]
 *   --skip-from <n>      First page to skip    [default: 75]
 *   --skip-to   <n>      Last page to skip     [default: 253]
 *   --chunk-words <n>    Target words per chunk [default: 300]
 *   --clear              Delete existing rows before ingesting (re-ingest)
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import pdfParse from "pdf-parse";

dotenv.config({ path: ".env.local" });

// ─── Config ──────────────────────────────────────────────────────────────────

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY       =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!OPENROUTER_API_KEY) throw new Error("❌  OPENROUTER_API_KEY missing in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("❌  Supabase credentials missing in .env.local");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: { "X-Title": "CIA Assessment PDF Ingest" },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Section map (derived from the PDF table of contents) ────────────────────
// Each entry defines a named section and its page range.
// Pages outside these ranges (and outside the skip range) get a fallback label.

const SECTIONS: { start: number; end: number; name: string }[] = [
  { start: 4,   end: 14,  name: "Puzzle Kesuksesan" },
  { start: 15,  end: 74,  name: "Dasar Teori QCB QMB QSB" },
  // 75–253: SKIP — already in cia_criteria
  { start: 254, end: 258, name: "Cara Menanamkan KMS Quranik" },
  { start: 259, end: 271, name: "Simulasi: Berpisah dengan Orangtua" },
  { start: 272, end: 284, name: "Simulasi: Tekanan Akademik" },
  { start: 285, end: 296, name: "Simulasi: Konflik Sosial" },
  { start: 297, end: 309, name: "Simulasi: Perubahan Lingkungan" },
  { start: 310, end: 321, name: "Simulasi: Kegagalan atau Penolakan" },
  { start: 322, end: 333, name: "Simulasi: Situasi Tidak Terduga" },
  { start: 334, end: 344, name: "Simulasi: Tekanan Moral atau Etika" },
  { start: 345, end: 356, name: "Simulasi: Medsos dan Perbandingan Diri" },
  { start: 357, end: 368, name: "Simulasi: Pengambilan Keputusan" },
  { start: 369, end: 380, name: "Simulasi: Kehilangan atau Duka" },
  { start: 381, end: 392, name: "Simulasi: Tantangan Identitas Diri" },
  { start: 393, end: 403, name: "Simulasi: Kompetisi dan Persaingan" },
  { start: 404, end: 419, name: "Simulasi: Kritik atau Teguran" },
  { start: 420, end: 436, name: "Simulasi: Penolakan" },
  { start: 437, end: 454, name: "Simulasi: Permintaan Bantuan" },
  { start: 455, end: 474, name: "Simulasi: Tidak Adil atau Diskriminatif" },
  { start: 475, end: 493, name: "Simulasi: Situasi Menyebalkan" },
  { start: 494, end: 512, name: "Simulasi: Dominan atau Terlalu Mengatur" },
  { start: 513, end: 528, name: "Simulasi: Pasif atau Tidak Kooperatif" },
  { start: 529, end: 542, name: "Simulasi: Meremehkan atau Merendahkan" },
  { start: 543, end: 558, name: "Simulasi: Emosional atau Marah" },
  { start: 559, end: 570, name: "Simulasi: Manipulatif atau Memperalat" },
  { start: 571, end: 587, name: "Simulasi: Tidak Konsisten" },
  { start: 588, end: 596, name: "Simulasi: Kompetitif Berlebihan" },
];

function getSectionName(pageNumber: number): string {
  const match = SECTIONS.find((s) => pageNumber >= s.start && pageNumber <= s.end);
  return match?.name ?? `Halaman ${pageNumber}`;
}

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
}

const pdfPath    = getArg("--pdf");
const skipFrom   = parseInt(getArg("--skip-from", "75")!,  10);
const skipTo     = parseInt(getArg("--skip-to",   "253")!, 10);
const chunkWords = parseInt(getArg("--chunk-words","300")!, 10);
const clearFirst = process.argv.includes("--clear");

if (!pdfPath) {
  console.error("❌  Usage: npx tsx scripts/ingest-pdf-knowledge.ts --pdf /path/to/book.pdf");
  process.exit(1);
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

interface PageText {
  pageNumber: number; // 1-based
  text: string;
}

async function extractPages(filePath: string): Promise<PageText[]> {
  const buffer = fs.readFileSync(path.resolve(filePath));
  const pages: PageText[] = [];

  // pdf-parse calls the render callback once per page
  await pdfParse(buffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((content: any) => {
        const text = content.items
          .map((item: any) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push({ pageNumber: pageData.pageNumber, text });
        return text;
      });
    },
  });

  return pages;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────
// Groups consecutive pages that share the same section name into ~chunkWords
// word chunks.  We split within a section rather than across sections so that
// every chunk stays topically coherent.

interface Chunk {
  content: string;
  section: string;
  pageStart: number;
  pageEnd: number;
}

function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];

  // Group pages by section
  const sectionGroups: Map<string, PageText[]> = new Map();
  const sectionOrder: string[] = [];

  for (const page of pages) {
    const section = getSectionName(page.pageNumber);
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
      sectionOrder.push(section);
    }
    sectionGroups.get(section)!.push(page);
  }

  for (const section of sectionOrder) {
    const sectionPages = sectionGroups.get(section)!;
    const fullText = sectionPages.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
    if (!fullText) continue;

    const words = fullText.split(" ");
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkWords, words.length);
      const chunkText = words.slice(start, end).join(" ").trim();

      if (chunkText.length > 50) { // skip near-empty chunks
        chunks.push({
          content: `[${section}]\n${chunkText}`,
          section,
          pageStart: sectionPages[0].pageNumber,
          pageEnd:   sectionPages[sectionPages.length - 1].pageNumber,
        });
      }

      start = end;
    }
  }

  return chunks;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📖  Reading PDF: ${pdfPath}`);
  const allPages = await extractPages(pdfPath!);
  console.log(`    Total pages extracted: ${allPages.length}`);

  // Filter out the skip range (already in cia_criteria)
  const eligiblePages = allPages.filter(
    (p) => p.pageNumber < skipFrom || p.pageNumber > skipTo
  );
  console.log(
    `    Skipping pages ${skipFrom}–${skipTo} (already in cia_criteria)`
  );
  console.log(`    Pages to ingest: ${eligiblePages.length}`);

  const chunks = chunkPages(eligiblePages);
  console.log(`    Chunks created: ${chunks.length} (target ~${chunkWords} words each)\n`);

  if (clearFirst) {
    console.log("🗑️   --clear flag set. Deleting existing pdf_knowledge rows...");
    const { error } = await supabase.from("pdf_knowledge").delete().neq("id", 0);
    if (error) console.error("    Delete error:", error.message);
    else console.log("    ✓ Table cleared\n");
  }

  // Ingest chunks one by one
  let success = 0;
  let failed  = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = `[${i + 1}/${chunks.length}]`;

    try {
      const embedding = await embedText(chunk.content);

      const { error } = await supabase.from("pdf_knowledge").insert({
        content:    chunk.content,
        section:    chunk.section,
        page_start: chunk.pageStart,
        page_end:   chunk.pageEnd,
        embedding,
      });

      if (error) {
        console.error(`  ${progress} ✗  ${chunk.section} (p.${chunk.pageStart}): ${error.message}`);
        failed++;
      } else {
        console.log(`  ${progress} ✓  ${chunk.section} (p.${chunk.pageStart}–${chunk.pageEnd})`);
        success++;
      }
    } catch (err: any) {
      console.error(`  ${progress} ✗  Embedding error: ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise((res) => setTimeout(res, 120));
  }

  console.log(`\n✅  Done! ${success} chunks ingested, ${failed} failed.`);
  if (failed > 0) {
    console.log("    Re-run with --clear to retry from scratch, or check the errors above.");
  }
}

main().catch(console.error);
