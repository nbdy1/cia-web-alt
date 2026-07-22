/**
 * scripts/ingest-bm400-knowledge.ts
 *
 * Chunks and embeds SMA Bakti Mulya 400 Jakarta's "Naskah Akademis Tiga
 * Pilar Pendidikan" reference document into pdf_knowledge, tagged with
 * organization_id so it's only retrieved for BM400 (see
 * scripts/migrations/20260722_bm400_supplementary_framework.sql).
 *
 * This is a one-off script for this specific 33-page document, not a
 * generalization of scripts/ingest-pdf-knowledge.ts (which is hardcoded to
 * the original ~600-page KMS guidebook's page-range table of contents).
 * Follows the same extraction/chunking/embedding pattern as that script.
 *
 * Section map (from the document's own table of contents / page footers):
 *   Page    3  : Pendahuluan
 *   Pages 4–13 : BAB I Pilar Religius (Filosofi, Tujuan, Nilai-Nilai Utama,
 *                Kompetensi, Implementasi, Indikator Keberhasilan)
 *   Pages 14–24: BAB II Pilar Nasionalis (same 6 subsections)
 *   Pages 25–31: BAB III Pilar Internasionalis (same 6 subsections)
 *   Page   32  : Penutup
 *   (Page 1–2 cover/daftar isi and page 33 Lampiran/tim perumus are skipped
 *    — no assessment-relevant content.)
 *
 * REQUIREMENTS:
 *   1. Run scripts/migrations/20260722_bm400_supplementary_framework.sql in
 *      the Supabase SQL Editor first (adds pdf_knowledge.organization_id).
 *   2. OPENROUTER_API_KEY and Supabase credentials in .env.local (same as
 *      ingest-framework.ts / ingest-pdf-knowledge.ts).
 *   3. Run:
 *        npx tsx scripts/ingest-bm400-knowledge.ts --pdf "/path/to/Naskah Akademis Tiga Pilar SMA Bakti Mulya 400 Jakarta.pdf"
 *
 * Options:
 *   --pdf         <path>  Path to the PDF [default: the Downloads path below]
 *   --org         <uuid>  organization_id to tag rows with [default: BM400]
 *   --chunk-words <n>     Target words per chunk [default: 300]
 *   --clear               Delete this org's existing pdf_knowledge rows first
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";
import { PDFParse } from "pdf-parse";

dotenv.config({ path: ".env.local" });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY       =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!OPENROUTER_API_KEY) throw new Error("❌  OPENROUTER_API_KEY missing in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("❌  Supabase credentials missing in .env.local");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: { "X-Title": "CIA Assessment PDF Ingest (BM400)" },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BM400_ORG_ID = "0bc3db16-d270-42d9-893a-c233a6b83800";
const DEFAULT_PDF_PATH =
  "/Users/nbdy1/Downloads/Naskah Akademis Tiga Pilar SMA Bakti Mulya 400 Jakarta.pdf";

const SECTIONS: { start: number; end: number; name: string }[] = [
  { start: 3,  end: 3,  name: "Pendahuluan" },
  { start: 4,  end: 13, name: "Pilar Religius" },
  { start: 14, end: 24, name: "Pilar Nasionalis" },
  { start: 25, end: 31, name: "Pilar Internasionalis" },
  { start: 32, end: 32, name: "Penutup" },
];

function getSectionName(pageNumber: number): string | null {
  return SECTIONS.find((s) => pageNumber >= s.start && pageNumber <= s.end)?.name ?? null;
}

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
}

const pdfPath     = getArg("--pdf", DEFAULT_PDF_PATH)!;
const orgId       = getArg("--org", BM400_ORG_ID)!;
const chunkWords  = parseInt(getArg("--chunk-words", "300")!, 10);
const clearFirst  = process.argv.includes("--clear");

// ─── PDF extraction ───────────────────────────────────────────────────────────

interface PageText {
  pageNumber: number; // 1-based
  text: string;
}

async function extractPages(filePath: string): Promise<PageText[]> {
  const buffer = fs.readFileSync(path.resolve(filePath));
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text.replace(/\s+/g, " ").trim(),
    }));
  } finally {
    await parser.destroy();
  }
}

// ─── Chunking (mirrors scripts/ingest-pdf-knowledge.ts) ───────────────────────

interface Chunk {
  content: string;
  section: string;
  pageStart: number;
  pageEnd: number;
}

function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];
  const sectionGroups: Map<string, PageText[]> = new Map();
  const sectionOrder: string[] = [];

  for (const page of pages) {
    const section = getSectionName(page.pageNumber);
    if (!section) continue; // cover, daftar isi, lampiran — no assessment-relevant content
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

      if (chunkText.length > 50) {
        chunks.push({
          content: `[${section}]\n${chunkText}`,
          section,
          pageStart: sectionPages[0].pageNumber,
          pageEnd: sectionPages[sectionPages.length - 1].pageNumber,
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
  const allPages = await extractPages(pdfPath);
  console.log(`    Total pages extracted: ${allPages.length}`);

  const chunks = chunkPages(allPages);
  console.log(`    Chunks created: ${chunks.length} (target ~${chunkWords} words each)`);
  console.log(`    Tagging with organization_id: ${orgId}\n`);

  if (clearFirst) {
    console.log(`🗑️   --clear flag set. Deleting existing pdf_knowledge rows for org ${orgId}...`);
    const { error } = await supabase.from("pdf_knowledge").delete().eq("organization_id", orgId);
    if (error) console.error("    Delete error:", error.message);
    else console.log("    ✓ Cleared\n");
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progress = `[${i + 1}/${chunks.length}]`;

    try {
      const embedding = await embedText(chunk.content);

      const { error } = await supabase.from("pdf_knowledge").insert({
        content: chunk.content,
        section: chunk.section,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        embedding,
        organization_id: orgId,
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

    await new Promise((res) => setTimeout(res, 120));
  }

  if (failed > 0) {
    throw new Error(`BM400 knowledge ingestion failed for ${failed} chunk(s); ${success} succeeded.`);
  }
  console.log(`\n✅  Done! ${success} chunks ingested, 0 failed.`);
}

main().catch(console.error);
