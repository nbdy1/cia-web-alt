/**
 * scripts/add-org-to-csv.mjs
 *
 * Adds an `organization_id` column to CSV exports from the OLD database (which
 * had no org column) so they can be imported into the current multi-tenant DB.
 *
 * Usage (run from the project root, where node_modules + .env.local live):
 *
 *   node scripts/add-org-to-csv.mjs students.csv reports.csv
 *
 * By default it looks up the "sekolah-impian" organization id from Supabase
 * (using SUPABASE_SERVICE_ROLE_KEY in .env.local). Options:
 *
 *   --org-id=<uuid>   Use this org id directly (skip the DB lookup).
 *   --slug=<slug>     Look up a different org slug (default: sekolah-impian).
 *
 * For each input file it writes "<name>.with-org.csv" next to it. It never
 * touches the original. Rows that already have a non-empty organization_id are
 * left as-is; empty/missing ones are filled.
 *
 * The CSV parser is RFC-4180 compliant: it correctly preserves quoted fields
 * that contain commas, double-quotes ("" escaping) and newlines — important
 * because reports contain JSON (treatment_plan) and multi-line narratives.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ── tiny RFC-4180 CSV parser / serializer ────────────────────────────────────
function parseCSV(text) {
  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else if (c === '\r') {
      // handle \r\n and lone \r
      row.push(field); field = '';
      rows.push(row); row = [];
      if (text[i + 1] === '\n') i++;
    } else {
      field += c;
    }
  }
  // trailing field / row (if file doesn't end with a newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function needsQuote(s) {
  return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r');
}
function serializeCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((f) => (needsQuote(f) ? `"${String(f).replace(/"/g, '""')}"` : f))
        .join(','),
    )
    .join('\r\n') + '\r\n';
}

// ── resolve org id ────────────────────────────────────────────────────────────
async function resolveOrgId(argOrgId, slug) {
  if (argOrgId) return argOrgId;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Could not resolve org id: pass --org-id=<uuid>, or ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local.',
    );
  }
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('organizations')
    .select('id, name')
    .eq('slug', slug)
    .single();
  if (error || !data) throw new Error(`Org with slug "${slug}" not found: ${error?.message ?? 'no row'}`);
  console.log(`→ Target organization: ${data.name} (${data.id})`);
  return data.id;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const orgIdArg = args.find((a) => a.startsWith('--org-id='))?.split('=')[1];
  const slug = args.find((a) => a.startsWith('--slug='))?.split('=')[1] ?? 'sekolah-impian';

  if (files.length === 0) {
    console.error('Usage: node scripts/add-org-to-csv.mjs <file1.csv> [file2.csv ...] [--org-id=UUID] [--slug=sekolah-impian]');
    process.exit(1);
  }

  const orgId = await resolveOrgId(orgIdArg, slug);

  for (const file of files) {
    const rows = parseCSV(readFileSync(file, 'utf8'));
    if (rows.length === 0) { console.warn(`! ${file}: empty, skipped`); continue; }

    const header = rows[0];
    let colIdx = header.indexOf('organization_id');
    if (colIdx === -1) {
      header.push('organization_id');
      colIdx = header.length - 1;
    }

    let filled = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      while (row.length < header.length) row.push(''); // pad short rows
      if (!row[colIdx] || row[colIdx].trim() === '') { row[colIdx] = orgId; filled++; }
    }

    const out = file.replace(/\.csv$/i, '') + '.with-org.csv';
    writeFileSync(out, serializeCSV(rows), 'utf8');
    console.log(`✓ ${path.basename(file)} → ${path.basename(out)}  (${rows.length - 1} rows, ${filled} org ids added)`);
  }

  console.log('\nDone. Import the *.with-org.csv files — students BEFORE reports.');
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
