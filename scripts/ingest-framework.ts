import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { karakterData } from '../lib/data/karakter';
import { mentalData } from '../lib/data/mental';
import { softSkillData } from '../lib/data/soft-skill';

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

async function ingestCategory(categoryName: string, categoryData: any) {
  console.log(`\n🚀 Starting ingestion for category: ${categoryName}`);
  
  for (const theme of categoryData.themes) {
    for (const indicator of theme.indicators) {
      for (const subIndicator of indicator.sub_indicators) {
        
        // 1. Create a rich, context-heavy string for the AI to embed
        const searchText = `Kategori: ${categoryName}. Tema: ${theme.title}. Indikator: ${indicator.title}. Sub-indikator: ${subIndicator}`;
        
        console.log(`Processing: ${subIndicator}`);
        
        try {
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
              embedding: embedding
            });

          if (error) {
            console.error(`❌ Error inserting to Supabase: ${error.message}`);
          }
        } catch (err: any) {
          console.error(`❌ Error generating embedding: ${err.message}`);
        }
        
        // Small delay to avoid hitting rate limits if you're on a free tier
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY is not set in .env.local!");
    console.error("Please add it and try again.");
    return;
  }

  console.log("Starting CIA Framework Ingestion...");
  
  // Clear the table first if you want a fresh start (uncomment if needed)
  // await supabase.from('cia_criteria').delete().neq('id', 0);
  
  await ingestCategory("Karakter", karakterData);
  await ingestCategory("Mental", mentalData);
  await ingestCategory("Soft Skill", softSkillData);
  
  console.log("\n✅ Ingestion Complete!");
}

main();
