// Usage: npm run download   (reads .env.local; saves everything to ./downloads)
import { createClient } from "@supabase/supabase-js";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const BUCKET = "wedding_uploads";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env. Run via: npm run download");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const OUT = "downloads";
const slug = (s) => String(s ?? "").normalize("NFKD").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60);

// Guest/original names from the table (optional, for nicer filenames).
const names = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from("wedding_uploads").select("storage_path,guest_name,original_name").range(from, from + 999);
  if (error) throw error;
  for (const r of data) names.set(r.storage_path, r);
  if (data.length < 1000) break;
}

// List the bucket itself (source of truth): top-level month folders, then files in each.
const { data: top, error: topErr } = await sb.storage.from(BUCKET).list("", { limit: 1000 });
if (topErr) throw topErr;
const folders = top.filter((o) => o.id === null).map((o) => o.name);

let n = 0, skipped = 0, bytes = 0;
for (const folder of folders) {
  await mkdir(path.join(OUT, folder), { recursive: true });
  for (let offset = 0; ; offset += 100) {
    const { data: files, error } = await sb.storage.from(BUCKET).list(folder, { limit: 100, offset });
    if (error) throw error;
    for (const f of files) {
      if (f.id === null) continue;
      const p = `${folder}/${f.name}`;
      const meta = names.get(p);
      const label = [slug(meta?.guest_name), slug(meta?.original_name)].filter(Boolean).join("_");
      const target = path.join(OUT, folder, label ? `${f.name.slice(0, 8)}_${label}` : f.name);
      const size = f.metadata?.size ?? 0;
      const existing = await stat(target).catch(() => null);
      if (existing && existing.size === size) { skipped++; continue; }

      const { data: signed, error: e2 } = await sb.storage.from(BUCKET).createSignedUrl(p, 3600);
      if (e2) { console.error("sign failed", p, e2.message); continue; }
      const res = await fetch(signed.signedUrl);
      if (!res.ok || !res.body) { console.error("download failed", p, res.status); continue; }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
      n++; bytes += size;
      console.log(`✓ ${target}`);
    }
    if (files.length < 100) break;
  }
}
console.log(`Done. ${n} downloaded (${(bytes / 1048576).toFixed(0)} MB), ${skipped} already present.`);
