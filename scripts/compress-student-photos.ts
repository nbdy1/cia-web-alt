import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const bucket = "student-photos";
const dryRun = process.argv.includes("--dry-run");

function storagePath(publicUrl: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(publicUrl.slice(index + marker.length).split("?")[0]);
}

async function main() {
  const { data: students, error } = await supabase
    .from("students")
    .select("id, photo_url")
    .not("photo_url", "is", null);
  if (error) throw error;

  let processed = 0;
  for (const student of students ?? []) {
    const sourcePath = storagePath(student.photo_url);
    if (!sourcePath) continue;
    const targetPath = `${student.id}.webp`;
    const sourceUrl = `${supabaseUrl}/storage/v1/render/image/public/${bucket}/${encodeURI(sourcePath)}?width=768&height=768&resize=contain&quality=78&format=webp`;
    process.stdout.write(`${dryRun ? "Would process" : "Processing"}: ${sourcePath}\n`);
    if (dryRun) continue;

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      console.warn(`  skipped (${response.status})`);
      continue;
    }
    const body = Buffer.from(await response.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(bucket).upload(targetPath, body, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: "31536000",
    });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(targetPath);
    const { error: updateError } = await supabase.from("students").update({ photo_url: publicUrl.publicUrl }).eq("id", student.id);
    if (updateError) throw updateError;
    if (sourcePath !== targetPath) await supabase.storage.from(bucket).remove([sourcePath]);
    processed++;
  }
  console.log(`Done: ${processed} photos ${dryRun ? "would be " : ""}processed.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
