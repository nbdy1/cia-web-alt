import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { karakterData } from '../lib/data/karakter';
import { mentalData } from '../lib/data/mental';
import { softSkillData } from '../lib/data/soft-skill';
import { ORG_FRAMEWORK_EXTENSIONS } from '../lib/data/framework';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// We use the OpenAI SDK, but point it to OpenRouter!
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://cia-assessment.id", // Optional
    "X-Title": "CIA Assessment", // Optional
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ingestCategory(categoryName: string, categoryData: any, organizationId: string | null = null): Promise<number> {
  console.log(`\n🚀 Starting ingestion for category: ${categoryName}${organizationId ? ` (org ${organizationId})` : ""}`);
  let failures = 0;

  for (const theme of categoryData.themes) {
    for (const indicator of theme.indicators) {
      for (const subIndicator of indicator.sub_indicators) {
        
        // 1. Create a rich, context-heavy string for the AI to embed
        const searchText = `Kategori: ${categoryName}. Tema: ${theme.title}. Indikator: ${indicator.title}. Sub-indikator: ${subIndicator}`;
        
        console.log(`Processing: ${subIndicator}`);
        
        try {
          let existingQuery = supabase
            .from('cia_criteria')
            .select('id')
            .eq('category', categoryName)
            .eq('theme', theme.title)
            .eq('indicator', indicator.title)
            .eq('sub_indicator', subIndicator);
          existingQuery = organizationId
            ? existingQuery.eq('organization_id', organizationId)
            : existingQuery.is('organization_id', null);
          const { data: existing, error: lookupError } = await existingQuery.maybeSingle();
          if (lookupError) throw lookupError;
          if (existing) {
            console.log(`Skipping existing criteria row ${existing.id}`);
            continue;
          }

          // 2. Generate the embedding vector using OpenAI via OpenRouter
          const embeddingResponse = await openai.embeddings.create({
            model: "openai/text-embedding-3-small",
            input: searchText,
          });
          
          const embedding = embeddingResponse.data[0].embedding;

          // 3. Save to Supabase
          const { error } = await supabase
            .from('cia_criteria')
            .insert({
              category: categoryName,
              theme: theme.title,
              indicator: indicator.title,
              sub_indicator: subIndicator,
              search_text: searchText,
              embedding: embedding,
              organization_id: organizationId,
            });

          if (error) {
            console.error(`❌ Error inserting to Supabase: ${error.message}`);
            failures++;
          }
        } catch (err: any) {
          console.error(`❌ Error generating embedding: ${err.message}`);
          failures++;
        }
        
        // Small delay to avoid hitting rate limits if you're on a free tier
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }
  return failures;
}

// --org <uuid>: ingest only that organization's supplementary themes
// (lib/data/framework.ts's ORG_FRAMEWORK_EXTENSIONS), tagged with
// organization_id so they're only visible when querying as that org. Without
// this flag, behavior is unchanged — the base 88-theme global framework,
// tagged organization_id: null (visible to every org).
function parseOrgFlag(): string | null {
  const idx = process.argv.indexOf('--org');
  return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is not set in .env.local!");
    console.error("Please add it and try again.");
    return;
  }

  const orgId = parseOrgFlag();

  if (orgId) {
    const extension = ORG_FRAMEWORK_EXTENSIONS[orgId];
    if (!extension) {
      console.error(`❌ No supplementary framework registered for organization_id ${orgId} in lib/data/framework.ts`);
      return;
    }
    console.log(`Starting supplementary framework ingestion for org ${orgId}...`);
    const failures = [
      extension.Karakter ? await ingestCategory("Karakter", extension.Karakter, orgId) : 0,
      extension.Mental ? await ingestCategory("Mental", extension.Mental, orgId) : 0,
      extension["Soft Skill"] ? await ingestCategory("Soft Skill", extension["Soft Skill"], orgId) : 0,
    ].reduce((total, count) => total + count, 0);
    if (failures > 0) throw new Error(`Supplementary ingestion failed for ${failures} row(s)`);
    console.log("\n✅ Org supplementary ingestion complete!");
    return;
  }

  console.log("Starting CIA Framework Ingestion...");

  // Clear the table first if you want a fresh start (uncomment if needed)
  // await supabase.from('cia_criteria').delete().neq('id', 0);

  const failures = [
    await ingestCategory("Karakter", karakterData),
    await ingestCategory("Mental", mentalData),
    await ingestCategory("Soft Skill", softSkillData),
  ].reduce((total, count) => total + count, 0);
  if (failures > 0) throw new Error(`Framework ingestion failed for ${failures} row(s)`);

  console.log("\n✅ Ingestion Complete!");
}

main();
