# CIA Portal — SaaS Billing, Usage Metering & Super-Admin Design

Status: proposal (Phase 1 schema shipping now). Owner: platform team.
Decisions baked in: **monthly quota per plan**, **hard cap** when a limit is hit,
**manual invoicing** now (payment gateway later), voice (ElevenLabs) gated to
higher tiers.

---

## 1. Why this exists

Today `/super-admin` can only create an organization and assign an owner. To run
this as a real SaaS we need three things the current schema can't express:

1. **Who is paying for what** — a subscription per organization tied to a plan,
   with status and billing dates.
2. **What each organization is consuming** — every AI call (LLM tokens and
   ElevenLabs characters) logged with cost and purpose, so we can bill fairly,
   spot abuse, and see our own margins.
3. **Enforcement** — stop usage when an org exceeds the plan it paid for, and
   only expose expensive features (voice) to the tiers that cover their cost.

The cost driver is not the LLM — it is voice. From the supplied figures:

| Component | Cost per assessment session |
|---|---|
| Gemini Flash + embedding (text) | **Rp308** |
| ElevenLabs Flash v2.5 voice (≈2.100 chars) | **Rp1.885** |

Voice is ~6× the text cost, so it is metered separately and unlocked only on
paid, higher tiers.

---

## 2. Plan tiers (recommended starting point)

Pricing is built so that **even at 100% quota utilisation** gross margin on AI
cost stays ≈ 60–70%. Real orgs rarely max their quota (typical usage ≈ 1
assessment per santri per month), so realised margin is higher. All figures
assume the supplied rates (kurs Rp17.950; text Rp308/report; voice
Rp0,898/char). Tune freely — limits live in the `plans` table, no redeploy
needed.

| Plan | Price / mo | Reports / mo | Voice (TTS) | Ustadz | Santri | Models | Worst-case COGS | Margin |
|---|---|---|---|---|---|---|---|---|
| **Trial** (14 days) | Free | 30 total | — | 2 | 25 | Flash | ~Rp9k once | — |
| **Dasar** | Rp199.000 | 200 | — (no voice) | 5 | 150 | Flash | Rp61.600 | ~69% |
| **Pro** | Rp699.000 | 600 | 60.000 chars (~28 voiced sessions) | 15 | 500 | Flash | Rp238.700 | ~66% |
| **Institusi** | Rp1.799.000 | 1.500 | 200.000 chars (~95 voiced sessions) | ∞ | 1.500 | Flash + premium | Rp641.600 | ~64% |
| **Enterprise** | Custom | Custom | Custom | ∞ | Custom | All + API | negotiated | — |

Notes:
- **Voice is a hard feature flag** (`features.voice_enabled`) *and* a metered
  quota. Below Pro it is simply off. On Pro/Institusi the character quota resets
  monthly; when exhausted, voice stops (text continues until the report quota is
  hit).
- Consider an **annual option** later (~2 months free) once billing is stable.
- "Reports" = a *finalised* assessment. Interview turns and profile/rapor
  generation are all logged for cost truth, but the quota the customer sees is
  counted on finalisation to keep it predictable.

---

## 3. Data model

All tables live in `public` and reuse the existing RLS helpers
(`is_organization_admin`, `is_organization_member`) plus one new
`is_platform_admin()`. Full DDL is in
`scripts/migrations/20260711_saas_billing_usage.sql`.

**`platform_admins`** — the company's own super-admins (global access), separate
from any organization. Replaces relying on the service-role key alone. Access to
every super-admin capability is gated on `is_platform_admin()`.

**`plans`** — plan catalogue (id, name, price, `max_reports_per_period`,
`max_voice_chars_per_period`, `max_ustadz`, `max_santri`, `features` jsonb). Seeded
with the tiers above; editable so you can change limits without shipping code.

**`subscriptions`** — one row per organization: `plan_id`, `status`
(`trialing` / `active` / `past_due` / `suspended` / `canceled`),
`current_period_start` / `current_period_end` (quota reset + renewal),
`trial_end`, optional `custom_price_idr` / `custom_limits` for Enterprise deals.
A trigger auto-creates a trial subscription when an org is created.

**`subscription_invoices`** — billing history for the manual flow: amount, period,
`status` (`open` / `paid` / `void` / `overdue`), `paid_at`, `payment_method`,
`external_ref` (reserved for a gateway later), and which super-admin recorded it.

**`ai_usage_events`** — the heart of metering. One row per AI call:
`organization_id`, `user_id`, optional `student_id` / `report_id`, `purpose`
(`interview_step` / `finalize` / `profile_summary` / `rapor` / `embedding` /
`tts`), `provider`, `model`, `input_tokens`, `output_tokens`, `char_count`
(voice), `cost_idr`, `status`, `latency_ms`. Token counts come straight from the
OpenRouter/ElevenLabs responses, so cost is actual, not estimated.

**`usage_counters`** — per-org, per-month rollup (reports, turns, tokens, voice
chars, cost) maintained by a trigger on `ai_usage_events`. Powers fast quota
checks and the super-admin dashboards without scanning the raw log.

**`ai_usage_rates`** — current provider rates (input/output per-Mtok, per-1k
chars) with `effective_from`, so costs are computed from a single source and can
be re-priced when FX moves.

**`audit_logs`** — every super-admin action (create org, assign plan, record
payment, grant quota…) for accountability.

A helper `organization_quota_status(org)` returns the current period's
reports/voice used vs the plan limits and the subscription status — one call the
UI and the enforcement guard both use.

---

## 4. Usage tracking & enforcement flow

**Logging (Phase 2).** A small server-side `logAiUsage()` helper wraps each AI
call. After OpenRouter returns, read its `usage.prompt_tokens` /
`completion_tokens`; for ElevenLabs use the character count of the input text.
Compute `cost_idr` from `ai_usage_rates` and insert one `ai_usage_events` row.
The `usage_counters` trigger updates the monthly rollup automatically.

**Enforcement (Phase 3), hard cap.** Before an AI action runs, a guard checks
`organization_quota_status(org)`:
- subscription `status` must be `active` or `trialing` — otherwise block with
  "subscription inactive".
- reports used < report limit — otherwise block with an **upgrade prompt**.
- for voice: `features.voice_enabled` must be true **and** voice chars < voice
  limit — otherwise fall back to text silently or show "voice quota reached".

Because it is a hard cap, there are no surprise bills; owners see a clear
limit-reached state and a link to upgrade.

---

## 5. Super-admin feature set (what's normal for B2B SaaS)

Beyond "create org + assign owner", a platform back-office typically covers:

- **Organization lifecycle** — create, edit, suspend, delete; view members and
  the owner; "view as org" impersonation for support.
- **Subscription management** — assign/change plan, start/extend trial, set
  custom price/limits (Enterprise), change status, set next billing date, cancel.
- **Billing** — record invoices and payments, mark paid/overdue, view an org's
  billing history. (Automated once a gateway lands.)
- **Usage & cost analytics** — global and per-org: tokens, characters, cost, and
  report volume over time; filter by period; break down by purpose / user /
  model; top consumers; quota utilisation; and **cost-vs-revenue margin per org**
  (this is where the metering pays off for you).
- **Quota controls** — grant bonus quota/credits, override limits.
- **Feature flags** — toggle voice, model access, or API per plan/org.
- **Platform admin management** — add/remove company super-admins.
- **Audit log** — searchable record of every admin action.
- **Alerts** — orgs near/over quota, failed payments, unusual usage spikes.

---

## 6. Security / RLS summary

- `platform_admins`, `audit_logs`: platform admins only.
- `plans`, `ai_usage_rates`: readable by any authenticated user (pricing page);
  writable by platform admins.
- `subscriptions`: readable by the org's members and platform admins; writable by
  platform admins (and the gateway/service later).
- `subscription_invoices`: readable by org admins (their org) and platform
  admins; writable by platform admins.
- `ai_usage_events`, `usage_counters`: readable by org admins (their org) and
  platform admins; usage rows inserted by the logged-in user's server action
  (own org) or the service role; counters maintained by a `SECURITY DEFINER`
  trigger.

The `/super-admin` route and layout should gate on `is_platform_admin()` (a new
`useIsPlatformAdmin` hook), not on the org role.

---

## 7. Roadmap

1. **Phase 1 (now)** — schema migration: plans (seeded), subscriptions (+ trial
   trigger), invoices, usage events + counters + rates, platform_admins,
   audit_logs, RLS. Designate the first platform admin.
2. **Phase 2** — `logAiUsage()` helper; instrument the AI server actions
   (`ai-analysis.ts`, `rapor.ts`, `speech.ts`/ElevenLabs) to record real usage.
3. **Phase 3** — enforcement guard (hard cap + voice gating) and graceful
   limit-reached UI.
4. **Phase 4** — super-admin UI: org & subscription management, invoices, and the
   usage/margin dashboards.
5. **Phase 5** — payment gateway (Midtrans or Xendit — local VA/QRIS/e-wallet,
   recurring) with webhooks replacing manual invoicing.
