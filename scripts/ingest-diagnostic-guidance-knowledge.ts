/**
 * Ingests the five-theme diagnostic and mentoring guidance PDF into
 * pdf_knowledge. These rows are intentionally not scoring criteria: they help
 * the AI relate observed situations to a possible developmental need and to
 * propose a practical, evidence-aware follow-up.
 *
 * Requirements:
 *   1. Run scripts/migrations/20260915_diagnostic_guidance_knowledge.sql.
 *   2. Set OPENROUTER_API_KEY and Supabase credentials in .env.local.
 *
 * Usage:
 *   npx tsx scripts/ingest-diagnostic-guidance-knowledge.ts --dry-run
 *   npx tsx scripts/ingest-diagnostic-guidance-knowledge.ts
 *   npx tsx scripts/ingest-diagnostic-guidance-knowledge.ts --clear
 *   npx tsx scripts/ingest-diagnostic-guidance-knowledge.ts --pdf /path/to/file.pdf
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

dotenv.config({ path: ".env.local" });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing in .env.local");
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase credentials missing in .env.local");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: { "X-Title": "CDS Diagnostic Guidance PDF Ingest" },
});
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SOURCE_DOCUMENT = "Uji coba akibat tidak memiliki QMS Quranik & cara membentuk indikator";
const DEFAULT_PDF_PATH = "/Users/nbdy1/Downloads/Uji coba akibat tidak memiliki QMS Quranik & cara membentuk indikator PDF.pdf";
const CHUNK_WORDS = 260;

type ThemeSource = { title: string; heading: RegExp };

// Themes are located from their actual chapter headings rather than a table of
// contents page map. The PDF starts and ends several themes mid-page, so this
// keeps the content and its label from drifting apart during ingestion.
const THEMES: ThemeSource[] = [
  { title: "Memiliki tujuan hidup", heading: /1\.\s*Karakter no 1\s*[“\"]Memiliki tujuan hidup/i },
  { title: "Mampu memimpin & dipimpin", heading: /2\.\s*Karakter no 2\s*[“\"]Mampu memimpin\s*&\s*dipimpin/i },
  { title: "Mampu mengatur diri & waktu dengan baik", heading: /3\.\s*Karakter no 3\s*[“\"]Mampu mengatur diri\s*&\s*waktu/i },
  { title: "Terlibat dalam kehidupan sosial & suka membantu", heading: /4\.\s*Karakter no 4\s*[“\"]Terlibat dalam kehidupan sosial\s*&\s*suka membantu/i },
  { title: "Konsisten ibadahnya & memiliki hubungan yang kuat dengan Al-Quran", heading: /5\.\s*Karakter no 5\s*[“\"]Konsisten ibadahnya\s*&\s*memiliki hubungan yang kuat/i },
];

function getArg(flag: string, fallback?: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

interface PageText {
  pageNumber: number;
  text: string;
}

interface Chunk {
  content: string;
  section: string;
  pageStart: number;
  pageEnd: number;
}

async function extractPages(filePath: string): Promise<PageText[]> {
  const parser = new PDFParse({ data: fs.readFileSync(path.resolve(filePath)) });
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

function pageNumberAt(position: number, pagePositions: { position: number; pageNumber: number }[]) {
  return pagePositions.reduce((pageNumber, current) => current.position <= position ? current.pageNumber : pageNumber, 1);
}

function chunkText(text: string, section: string, pageStart: number, pageEnd: number): Chunk[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const chunks: Chunk[] = [];
  for (let offset = 0; offset < words.length; offset += CHUNK_WORDS) {
    const content = words.slice(offset, offset + CHUNK_WORDS).join(" ").trim();
    if (content.length >= 60) chunks.push({ content: `[${section}]\n${content}`, section, pageStart, pageEnd });
  }
  return chunks;
}

function createChunks(pages: PageText[]): Chunk[] {
  const bodyPages = pages.filter((page) => page.pageNumber >= 3);
  const pagePositions: { position: number; pageNumber: number }[] = [];
  let source = "";
  for (const page of bodyPages) {
    pagePositions.push({ position: source.length, pageNumber: page.pageNumber });
    source += `${page.text}\n`;
  }

  const starts = THEMES.map((theme) => ({ theme, match: theme.heading.exec(source) }))
    .map(({ theme, match }) => {
      if (!match) throw new Error(`Could not find chapter heading for ${theme.title}`);
      return { theme, position: match.index };
    });

  return starts.flatMap(({ theme, position }, index) => {
    const end = starts[index + 1]?.position ?? source.length;
    const themeText = source.slice(position, end).trim();
    const guidanceMatch = /2\)\s*Cara agar seorang anak/i.exec(themeText);
    if (!guidanceMatch) throw new Error(`Could not find mentoring section for ${theme.title}`);

    const pageStart = pageNumberAt(position, pagePositions);
    const pageEnd = pageNumberAt(end - 1, pagePositions);
    const diagnosisSection = `Panduan diagnosis: ${theme.title} - dampak bila belum berkembang`;
    const guidanceSection = `Panduan pembinaan: ${theme.title} - sasaran mentoring`;
    return [
      ...chunkText(themeText.slice(0, guidanceMatch.index), diagnosisSection, pageStart, pageEnd),
      ...chunkText(themeText.slice(guidanceMatch.index), guidanceSection, pageStart, pageEnd),
    ];
  });
}

async function embedText(text: string) {
  const response = await openai.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function main() {
  const pdfPath = getArg("--pdf", DEFAULT_PDF_PATH)!;
  const clearFirst = process.argv.includes("--clear");
  const dryRun = process.argv.includes("--dry-run");
  console.log(`\nReading diagnostic guidance PDF: ${pdfPath}`);

  const pages = await extractPages(pdfPath);
  const chunks = createChunks(pages);
  console.log(`  Extracted ${pages.length} pages and created ${chunks.length} labelled chunks.`);

  if (dryRun) {
    for (const chunk of chunks) {
      console.log(`  Would ingest: ${chunk.section} (p.${chunk.pageStart}-${chunk.pageEnd}) — ${chunk.content.slice(0, 115).replace(/\s+/g, " ")}`);
    }
    return;
  }

  if (clearFirst) {
    console.log(`  Removing existing rows for source: ${SOURCE_DOCUMENT}`);
    const { error } = await supabase
      .from("pdf_knowledge")
      .delete()
      .eq("source_document", SOURCE_DOCUMENT);
    if (error) throw new Error(`Could not clear existing guidance: ${error.message}`);
  } else {
    const { count, error } = await supabase
      .from("pdf_knowledge")
      .select("id", { count: "exact", head: true })
      .eq("source_document", SOURCE_DOCUMENT);
    if (error) throw new Error(`Could not check existing guidance: ${error.message}`);
    if ((count ?? 0) > 0) {
      throw new Error(`This source already has ${count} row(s). Re-run with --clear to replace only this source.`);
    }
  }

  let completed = 0;
  for (const [index, chunk] of chunks.entries()) {
    const embedding = await embedText(chunk.content);
    const { error } = await supabase.from("pdf_knowledge").insert({
      content: chunk.content,
      section: chunk.section,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      embedding,
      organization_id: null,
      knowledge_type: "diagnostic_guidance",
      source_document: SOURCE_DOCUMENT,
    });
    if (error) throw new Error(`Chunk ${index + 1} (${chunk.section}) failed: ${error.message}`);
    completed++;
    console.log(`  [${completed}/${chunks.length}] ${chunk.section}`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  console.log(`\nDone. ${completed} diagnostic-guidance chunks ingested.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
