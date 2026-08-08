/**
 * lib/slug.ts
 *
 * Turns a free-typed org name into a URL/subdomain-safe slug — used to
 * auto-fill the Slug field when a super-admin creates a new organization
 * (app/super-admin/page.tsx). Kept as a standalone pure function so it's
 * testable without mounting the create-org form.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
