# CIA Portal

**Character Integrated Assessment** — an AI-assisted character assessment platform for Islamic boarding schools (pesantren). Ustadz (teachers) conduct conversational interviews about their students; the AI maps observations to a structured 3-pillar framework (Karakter, Mental, Soft Skill) and generates structured reports.

For a full architectural overview see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in your keys (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenRouter (required — used for LLM chat + embeddings)
OPENROUTER_API_KEY=your-openrouter-key

# ElevenLabs (optional — only if you want high-quality TTS)
# Also set USE_ELEVENLABS = true in lib/hooks/use-cia-voice.ts
ELEVENLABS_API_KEY=your-elevenlabs-key
```

---

## Database Setup (first-time)

1. Create a Supabase project and run the following scripts in order in the Supabase SQL editor:

   ```
   scripts/setup_vector.sql          -- enables pgvector + creates match_cia_criteria RPC
   scripts/add_report_title.sql      -- adds title column to reports table
   scripts/add_profile_summary.sql   -- adds profile_summary column to students table
   scripts/create_admin_profile.sql  -- creates the first admin user
   ```

2. Seed framework embeddings for RAG (requires `OPENROUTER_API_KEY`):

   ```bash
   npx ts-node scripts/ingest-framework.ts
   ```

3. (Optional) Load test data for development:

   ```sql
   -- In Supabase SQL editor, replace <student_uuid> with a real student ID:
   -- scripts/seed_test_reports.sql   — basic kuat/lemah test scenario
   -- scripts/seed_test_reports_2.sql — multi-theme scenario for radar chart testing
   ```

---

## Creating an Admin Account

After signing up through the login page, open the Supabase dashboard → Table Editor → `profiles` and set `role = 'admin'` for your user. Or run `scripts/create_admin_profile.sql` with your user's UUID.

---

## Project Structure

```
app/             Next.js pages (App Router) + server actions
components/      Shared React components
lib/
  data/          CIA framework data (karakter, mental, soft-skill) + AI prompts
  context/       Auth context
  hooks/         Custom hooks (voice, user role)
scripts/         DB migrations, setup scripts, test data
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full breakdown.

---

## Key Features

- **AI Interview** — Gemini (via OpenRouter) asks contextual follow-up questions based on what the teacher describes, using RAG to pull the most relevant CIA criteria
- **Structured Reports** — AI output is post-processed deterministically to ensure accurate sub-indicator mapping and statistics
- **Radar Charts** — per-category spider charts showing cumulative fulfillment across all of a student's reports
- **Kuat / Lemah Classification** — sub-indicators fulfilled in ≥3 reports are "Kuat" (strong); 1–2 reports are "Lemah" (weak)
- **Role-Based Access** — admin can manage all students and ustadz; each ustadz sees only their assigned students
- **Accessibility** — 4 font options + scale slider, persisted to localStorage

---

## Browser Compatibility

Voice input (microphone) uses the Web Speech API and **works in Chrome only**. All other features work in any modern browser.
