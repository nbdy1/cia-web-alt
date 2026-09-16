/**
 * Rebuilds the global Mental RAG rows from lib/data/mental.ts.
 *
 * Usage:
 *   npx tsx scripts/sync-mental-framework.ts --dry-run
 *   npx tsx scripts/sync-mental-framework.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { mentalData } from "../lib/data/mental";

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
  defaultHeaders: { "X-Title": "CDS Mental Framework Sync" },
});
const apply = process.argv.includes("--apply");

type Criterion = {
  id: number;
  category: "Mental";
  theme: string;
  indicator: string;
  sub_indicator: string;
  search_text: string;
  embedding?: number[];
  organization_id: null;
};

function criteria(firstId: number): Criterion[] {
  let id = firstId;
  return mentalData.themes.flatMap((theme) =>
    theme.indicators.flatMap((indicator) =>
      indicator.sub_indicators.map((subIndicator) => ({
        id: id++,
        category: "Mental" as const,
        theme: theme.title,
        indicator: indicator.title,
        sub_indicator: subIndicator,
        search_text: `Kategori: Mental. Tema: ${theme.title}. Indikator: ${indicator.title}. Sub-indikator: ${subIndicator}`,
        organization_id: null,
      })),
    ),
  );
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
    .eq("category", "Mental")
    .is("organization_id", null);
  if (countError) throw countError;

  console.log(`Canonical Mental rows: ${rows.length}`);
  console.log(`Existing global Mental rows: ${count ?? 0}`);
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to replace the global Mental RAG rows.");
    return;
  }

  console.log("Generating embeddings...");
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const response = await openai.embeddings.create({
      model: "openai/text-embedding-3-small",
      input: batch.map((row) => row.search_text),
    });
    response.data.forEach((item, offset) => { batch[offset].embedding = item.embedding; });
    console.log(`  ${Math.min(index + 100, rows.length)}/${rows.length}`);
  }

  const { error: deleteError } = await db.from("cia_criteria")
    .delete().eq("category", "Mental").is("organization_id", null);
  if (deleteError) throw deleteError;

  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await db.from("cia_criteria").insert(rows.slice(index, index + 100));
    if (error) throw error;
  }
  console.log(`Synced ${rows.length} global Mental RAG rows.`);
}

main().catch((error) => {
  console.error("Mental framework sync failed:", error.message);
  process.exitCode = 1;
});
