# CDS Portal — Architecture Overview

**Character Development System (CDS)** is a web portal for Islamic boarding schools (pesantren) to conduct AI-assisted character development assessments of students (santri). Ustadz (teachers) conduct conversational interviews; the AI maps observations to a structured 3-pillar framework and generates a structured report.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + custom CSS tokens in `globals.css` |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (email/password) |
| LLM / Chat | OpenRouter API → `google/gemini-3-flash-preview` |
| Embeddings | OpenRouter API → `openai/text-embedding-3-small` |
| TTS | Browser `SpeechSynthesis` (default) or ElevenLabs (opt-in) |
| Voice Input | Web Speech API / `SpeechRecognition` — Chrome only |
| Search | Fuse.js (client-side fuzzy search) |
| Icons | Lucide React |
| Fonts | DIN Rounded (local), Nunito, Plus Jakarta Sans, Atkinson Hyperlegible |

---

## Folder Structure

```
cia-web-alt/
├── app/                        # Next.js App Router pages & server actions
│   ├── actions/                # Server Actions ("use server")
│   │   ├── ai-analysis.ts      # ← CORE: interview + analysis AI engine
│   │   ├── save-assessment.ts  # Persist completed report to Supabase
│   │   ├── performance-data.ts # Admin dashboard stats
│   │   ├── speech.ts           # ElevenLabs TTS proxy (optional)
│   │   └── reports.ts          # LEGACY — no longer used by UI
│   ├── admin/                  # Admin-only routes (role-guarded)
│   │   ├── layout.tsx          # Admin layout + role redirect guard
│   │   ├── page.tsx            # Dashboard with 7 data widgets
│   │   ├── santri/page.tsx     # Student CRUD
│   │   ├── ustadz/page.tsx     # Teacher CRUD
│   │   ├── assignments/page.tsx# Assign students to ustadz
│   │   └── monitoring/page.tsx # Ustadz → Students → Reports hierarchy
│   ├── create-report/          # 3-step assessment workflow
│   │   ├── page.tsx            # Step 1: Select student
│   │   ├── assessment/page.tsx # Step 2: AI interview chat
│   │   ├── analysis/page.tsx   # (Legacy redirect page, rarely hit)
│   │   └── results/page.tsx    # Step 3: Review & save report
│   ├── reports/[id]/page.tsx   # Read-only single report view
│   ├── students/
│   │   ├── page.tsx            # Paginated student list
│   │   └── [id]/
│   │       ├── page.tsx        # Student profile + report history
│   │       └── recap/page.tsx  # Aggregated sub-indicator summary + radar charts
│   ├── login/page.tsx          # Auth (login / signup)
│   ├── page.tsx                # Home / navigation hub
│   ├── layout.tsx              # Root layout (fonts, auth provider, flash prevention)
│   └── globals.css             # Tailwind + design tokens
├── components/                 # Shared client components
│   ├── CriteriaGlossaryModal.tsx  # Searchable framework reference modal
│   ├── SettingsDropdown.tsx    # Font/size picker + glossary launcher
│   ├── SmartBackButton.tsx     # Context-aware back navigation
│   ├── ReportBackButton.tsx    # Back button for report detail pages
│   └── LayoutWrapper.tsx       # Session history tracker + layout mode selector
├── lib/
│   ├── context/auth-context.tsx   # Global Supabase auth state + redirect guard
│   ├── hooks/
│   │   ├── use-cia-voice.ts    # TTS hook (ElevenLabs / native SpeechSynthesis)
│   │   └── use-user-role.ts    # Fetch user role from profiles table
│   ├── data/                   # CDS assessment framework (source of truth)
│   │   ├── karakter.ts         # 40 Character themes
│   │   ├── mental.ts           # 34 Mental resilience themes
│   │   ├── soft-skill.ts       # 14 Soft skill themes
│   │   └── prompts.ts          # LLM prompt templates (interview + analysis)
│   └── supabase.ts             # Supabase JS client singleton
└── scripts/                    # Database setup & maintenance
    ├── ingest-framework.ts     # Seed pgvector embeddings for RAG
    ├── setup_vector.sql        # Enable pgvector + create match_cia_criteria RPC
    ├── add_report_title.sql    # Schema migration: add title column
    ├── create_admin_profile.sql# Seed: create first admin user
    ├── phaseout_report_scores.sql  # Legacy cleanup: drop old scores table
    ├── seed_test_reports.sql   # Test data: kuat/lemah scenario (basic)
    ├── seed_test_reports_2.sql # Test data: multi-theme scenario (radar chart)
    └── dev/
        ├── scratch.js          # Debug: query treatment_plan JSON
        └── test_sql.js         # Debug: test Supabase exec_sql RPC
```

---

## Assessment Workflow (3 Steps)

```
/create-report           →  Select student
/create-report/assessment →  AI interview chat  ← calls processInterviewStep() per message
                                                ← calls finalizeAssessment() on finish
/create-report/results   →  Review & save       ← calls saveAssessmentAction()
```

### Step 1 — Student Selection (`create-report/page.tsx`)
- Fetches all students from Supabase; filters by `assigned_ustadz_id` for ustadz role
- Fuse.js fuzzy search; optional voice search via `SpeechRecognition` (Chrome)

### Step 2 — AI Interview Chat (`create-report/assessment/page.tsx`)
- Streaming chat UI; teacher types or dictates observations about the student
- Every message calls `processInterviewStep()` (server action):
  1. Embeds the last 4 messages via OpenRouter embeddings API
  2. Retrieves top-15 relevant CDS criteria from Supabase pgvector (`match_cia_criteria` RPC)
  3. Sends the retrieved criteria + transcript to Gemini for a follow-up question
  4. Returns `{ reply, discoveredPillars }` — AI never reveals theme names to teacher
- `discoveredPillars` accumulates in client state across turns
- "Selesai" button (≥2 messages) calls `finalizeAssessment()`:
  1. Fetches student's previous report for progress context
  2. RAG: embeds full transcript, retrieves top-30 relevant criteria
  3. Sends criteria + transcript to Gemini for structured JSON analysis
  4. Post-processes AI output deterministically (see below)
  5. Stores result in `sessionStorage` and redirects to `/results`

### Step 3 — Results (`create-report/results/page.tsx`)
- Reads analysis JSON from `sessionStorage`
- Displays status summary, treatment plan, and per-category breakdowns
- "Simpan" calls `saveAssessmentAction()`: inserts into `reports.treatment_plan` (JSONB)

---

## AI Post-Processing (Deterministic Corrections)

The LLM output is never trusted directly. `ai-analysis.ts` applies three passes:

| Pass | Function | Purpose |
|---|---|---|
| 1 | `enrichDetailedAssessments()` | Re-maps AI indicator names to exact framework strings (fuzzy match); deduplicates; computes fulfilled/missing sub-indicators from canonical source |
| 2 | `enrichTreatment()` | Pins treatment plan to canonical indicator names from pass 1 |
| 3 | `computeOverallStats()` | Counts fulfilled sub-indicators per category against the FULL local framework (not just the RAG subset). Always 100% accurate. |

---

## CDS Framework Data Model

Three pillars, each with themes → indicators → sub-indicators:

```
Pillar (category)
  └── Theme  (e.g. "Memiliki tujuan hidup")
        └── Indicator  (e.g. "Punya cita-cita yang teguh")
              └── Sub-indicator  (e.g. "Cita-citanya tak berubah-ubah...")
```

| Pillar | File | Themes | Definition |
|---|---|---|---|
| Karakter | `lib/data/karakter.ts` | 40 | Permanent character traits & Islamic ethics (akhlak) |
| Mental | `lib/data/mental.ts` | 34 | Ability to manage one's internal state |
| Soft Skill | `lib/data/soft-skill.ts` | 14 | Ability to handle others' attitudes and actions |

Sub-indicators are the atomic unit. Each assessment maps observed behaviour to specific sub-indicators. The recap page counts how many reports fulfilled each sub-indicator across a student's history.

---

## Database Schema (Supabase)

| Table | Key Columns | Notes |
|---|---|---|
| `auth.users` | `id`, `email` | Managed by Supabase Auth |
| `profiles` | `id` (FK users), `role`, `name` | "admin" or "ustadz" |
| `students` | `id`, `name`, `assigned_ustadz_id` (FK profiles), `profile_summary` (TEXT) | santri records; `profile_summary` is an AI-generated 150–200 word character profile regenerated after each saved report (see [Rolling Profile](#rolling-student-profile)) |
| `reports` | `id`, `student_id`, `title`, `narrative`, `treatment_plan` (JSONB), `created_at` | Full analysis stored as JSONB |
| `themes` | `id`, `category`, `title`, `embedding` (vector) | Seeded by ingest-framework.ts |
| `indicators` | `id`, `theme_id`, `title` | |
| `sub_indicators` | `id`, `indicator_id`, `text`, `embedding` (vector) | pgvector for RAG |

The `match_cia_criteria` Postgres function (defined in `scripts/setup_vector.sql`) performs cosine similarity search on sub-indicator embeddings for RAG retrieval.

---

## Recap Page: Kuat / Lemah Logic

The recap page (`/students/[id]/recap`) aggregates all of a student's reports:

```
For each report:
  For each detailed_assessment in treatment_plan:
    For each fulfilled_sub_indicator:
      countMap[normalise(sub_indicator)]++

Classification:
  count >= 3  → "kuat"  (strong, emerald badge)
  count >= 1  → "lemah" (weak, amber badge)
  count == 0  → "unfulfilled" (grey)
```

The radar chart plots per-theme fulfillment percentage (any count ≥ 1 qualifies as fulfilled for the chart) as a proportion of total sub-indicators in that theme.

---

## Role-Based Access Control

| Route | Admin | Ustadz |
|---|---|---|
| `/` | ✓ | ✓ |
| `/students` | All students | Assigned students only |
| `/students/[id]` | ✓ | Own students only |
| `/create-report` | ✓ | ✓ |
| `/admin/*` | ✓ | ✗ (redirected to /) |

Role is stored in `profiles.role` and fetched client-side via `useUserRole()`. Access control is enforced in both the UI (guards + redirects) and by Supabase Row-Level Security policies.

---

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon/public key
OPENROUTER_API_KEY=                # OpenRouter API key (LLM + embeddings)

# Optional (ElevenLabs TTS — disabled by default)
ELEVENLABS_API_KEY=                # Only needed if USE_ELEVENLABS = true
                                   # in lib/hooks/use-cia-voice.ts
```

---

## Rolling Student Profile

To give the AI historical awareness of each student without injecting full report JSON (which would cost thousands of tokens), a compact rolling profile is stored in `students.profile_summary`.

**How it works:**
1. After each report is saved (`saveAssessmentAction`), `generateStudentProfile(studentId)` is called.
2. It fetches the student's last 5 reports and extracts: status summary, assessed themes, and priority treatment from each.
3. A single cheap LLM call condenses this into a 150–200 word Indonesian character profile.
4. The profile is written back to `students.profile_summary`.

**How it's used:**
- `processInterviewStep()` — reads `profile_summary` at the start of each interview message and injects it into the system prompt so the AI can ask informed follow-up questions (probe known weak areas, validate past strengths).
- `finalizeAssessment()` — injects the profile into the final analysis prompt so the treatment plan is personalised to the student's known personality.

**Token cost:** ~250 extra tokens per call (interview step + final analysis). The profile generation itself is one cheap call (no vector search) and runs after the user has already left the results page.

**Migration:** Run `scripts/add_profile_summary.sql` once in Supabase to add the column. Existing students start with a `NULL` profile; the first save after the migration generates their profile.

---

## Key Design Decisions

**Why sessionStorage for analysis data?**
The finalised analysis JSON can be 20–50 KB. Passing it via URL params would exceed browser limits. sessionStorage survives the redirect but not a tab close.

**Why local TypeScript files for framework data?**
The framework rarely changes. Keeping it in `.ts` files gives compile-time type safety, instant access without DB queries, and lets the recap + glossary pages work without a network round-trip. The same data is also seeded into Supabase for vector search.

**Why deterministic post-processing instead of trusting the LLM?**
The LLM sometimes hallucinates sub-indicator names or reports wrong counts. By cross-referencing AI output against the local framework source, we guarantee the saved data always uses canonical names and accurate statistics.

**Why no client-side framework for the radar chart?**
The RadarChart component in `recap/page.tsx` is a pure SVG generated as a React Server Component. No Recharts or D3 needed — the chart is lighter, faster, and doesn't require hydration.

**Why Chrome-only voice input?**
The Web Speech API (`SpeechRecognition`) is a Chrome extension not part of the web standard. Adding cross-browser support would require a paid STT API (e.g. OpenAI Whisper). The current user base uses Chrome, so this tradeoff was intentional.
