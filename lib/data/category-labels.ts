/**
 * lib/data/category-labels.ts
 *
 * Display-only label for the "Karakter" pillar. The framework/DB/AI-output
 * category value stays "Karakter" everywhere (it's what's already stored in
 * every existing report's treatment_plan JSONB, and what the AI is
 * instructed to emit — see lib/data/prompts.ts) — only the label shown to
 * users is "Character". Never compare against categoryDisplayLabel() output;
 * always compare/key against the raw "Karakter" | "Mental" | "Soft Skill".
 */

export function categoryDisplayLabel(category: string): string {
  if (category === "Karakter") return "Character";
  if (category === "karakter") return "character";
  return category;
}
