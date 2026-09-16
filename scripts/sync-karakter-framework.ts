/**
 * Rebuilds the global Karakter RAG rows from lib/data/karakter.ts.
 *
 * The framework file is the canonical source. This script deliberately only
 * touches global Karakter rows, leaving Mental, Soft Skill, and every
 * organization-specific extension intact.
 *
 * Usage:
 *   npx tsx scripts/sync-karakter-framework.ts --dry-run
 *   npx tsx scripts/sync-karakter-framework.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { karakterData } from "../lib/data/karakter";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.OPENROUTER_API_KEY;
if (!url || !key || !apiKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENROUTER_API_KEY in .env.local");
}

const db = createClient(url, key);
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey,
  defaultHeaders: { "X-Title": "CDS Karakter Framework Sync" },
});
const apply = process.argv.includes("--apply");

type Criterion = {
  id: number;
  category: "Karakter";
  theme: string;
  indicator: string;
  sub_indicator: string;
  search_text: string;
  embedding?: number[];
  organization_id: null;
};

function criteria(firstId: number): Criterion[] {
  let id = firstId;
  return karakterData.themes.flatMap((theme) =>
    theme.indicators.flatMap((indicator) =>
      indicator.sub_indicators.map((subIndicator) => ({
        id: id++,
        category: "Karakter" as const,
        theme: theme.title,
        indicator: indicator.title,
        sub_indicator: subIndicator,
        search_text: `Kategori: Karakter. Tema: ${theme.title}. Indikator: ${indicator.title}. Sub-indikator: ${subIndicator}`,
        organization_id: null,
      })),
    ),
  );
}

async function embedBatch(texts: string[]) {
  const response = await openai.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

async function main() {
  const { data: highestIdRow, error: highestIdError } = await db
    .from("cia_criteria")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (highestIdError) throw highestIdError;

  const rows = criteria(Number(highestIdRow?.id ?? 0) + 1);
  const { count, error: countError } = await db
    .from("cia_criteria")
    .select("id", { count: "exact", head: true })
    .eq("category", "Karakter")
    .is("organization_id", null);
  if (countError) throw countError;

  console.log(`Canonical Karakter rows: ${rows.length}`);
  console.log(`Existing global Karakter rows: ${count ?? 0}`);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to replace the global Karakter RAG rows.");
    return;
  }

  console.log("Generating embeddings...");
  const embeddingBatchSize = 100;
  for (let index = 0; index < rows.length; index += embeddingBatchSize) {
    const batch = rows.slice(index, index + embeddingBatchSize);
    const embeddings = await embedBatch(batch.map((row) => row.search_text));
    embeddings.forEach((embedding, offset) => {
      batch[offset].embedding = embedding;
    });
    console.log(`  ${Math.min(index + embeddingBatchSize, rows.length)}/${rows.length}`);
  }

  const { error: deleteError } = await db
    .from("cia_criteria")
    .delete()
    .eq("category", "Karakter")
    .is("organization_id", null);
  if (deleteError) throw deleteError;

  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const { error: insertError } = await db.from("cia_criteria").insert(batch);
    if (insertError) throw insertError;
  }
  console.log(`Synced ${rows.length} global Karakter RAG rows.`);
}

main().catch((error) => {
  console.error("Karakter framework sync failed:", error.message);
  process.exitCode = 1;
});
