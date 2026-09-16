/**
 * Repairs a small set of legacy framework strings that were accidentally
 * stored incomplete in both the TypeScript source and cia_criteria RAG table.
 *
 * Usage:
 *   npx tsx scripts/repair-truncated-framework-criteria.ts --dry-run
 *   npx tsx scripts/repair-truncated-framework-criteria.ts
 *
 * The script only changes global (organization_id IS NULL) rows. It rebuilds
 * each changed row's search_text and embedding, so retrieval sees the repaired
 * wording rather than a stale vector for the truncated phrase.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !openRouterApiKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENROUTER_API_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: openRouterApiKey,
  defaultHeaders: { "X-Title": "CDS Framework Criteria Repair" },
});
const dryRun = process.argv.includes("--dry-run");

type Repair = {
  field: "indicator" | "sub_indicator";
  from: string;
  to: string;
};

const REPAIRS: Repair[] = [
  {
    field: "sub_indicator",
    from: "Berpikiran Positif ; Mampu membangun suasana optimis dan mendorong tim untuk",
    to: "Berpikiran positif; mampu membangun suasana optimis dan mendorong tim untuk mencapai tujuan bersama.",
  },
  {
    field: "sub_indicator",
    from: "Memiliki Kepercayaan diri yang baik ; Menunjukkan keyakinan dalam mengambil",
    to: "Memiliki kepercayaan diri yang baik; menunjukkan keyakinan dalam mengambil keputusan.",
  },
  {
    field: "sub_indicator",
    from: "Pandai berkomunikasi ; Menyampaikan visi dengan jelas, pembicara yang baik, juga",
    to: "Pandai berkomunikasi; menyampaikan visi dengan jelas, serta menjadi pembicara dan pendengar yang baik.",
  },
  {
    field: "indicator",
    from: "Kesadaran bahwa tujuan belajar itu adalah ilmu (bukan ijazah atau sekedar untuk",
    to: "Kesadaran bahwa tujuan belajar adalah ilmu, bukan ijazah atau sekadar formalitas",
  },
  {
    field: "sub_indicator",
    from: "Tidak cepat puas ketika menang dan",
    to: "Tidak cepat puas ketika menang dan terus berusaha meningkatkan diri.",
  },
];

async function embed(searchText: string) {
  const response = await openai.embeddings.create({
    model: "openai/text-embedding-3-small",
    input: searchText,
  });
  return response.data[0].embedding;
}

async function main() {
  let matched = 0;
  let updated = 0;

  for (const repair of REPAIRS) {
    const { data: rows, error } = await supabase
      .from("cia_criteria")
      .select("id, category, theme, indicator, sub_indicator")
      .eq(repair.field, repair.from)
      .is("organization_id", null);
    if (error) throw error;

    for (const row of rows ?? []) {
      matched++;
      const indicator = repair.field === "indicator" ? repair.to : row.indicator;
      const subIndicator = repair.field === "sub_indicator" ? repair.to : row.sub_indicator;
      const searchText = `Kategori: ${row.category}. Tema: ${row.theme}. Indikator: ${indicator}. Sub-indikator: ${subIndicator}`;

      if (dryRun) {
        console.log(`Would repair ${row.id}: ${repair.field}`);
        continue;
      }

      const embedding = await embed(searchText);
      const { error: updateError } = await supabase
        .from("cia_criteria")
        .update({
          indicator,
          sub_indicator: subIndicator,
          search_text: searchText,
          embedding,
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      updated++;
      console.log(`Repaired ${row.id}: ${repair.field}`);
    }
  }

  console.log(dryRun
    ? `Dry run complete: ${matched} row(s) would be repaired.`
    : `Repair complete: ${updated}/${matched} row(s) repaired.`);
}

main().catch((error) => {
  console.error("Framework criteria repair failed:", error.message);
  process.exitCode = 1;
});
