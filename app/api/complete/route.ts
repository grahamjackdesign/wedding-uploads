import { BUCKET, PATH_RE, admin, eventCodeOk, resolveType } from "@/lib/storage";

/** Called by the browser after a file is uploaded. Verifies it really exists, then records it. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !eventCodeOk(body.code)) {
    return Response.json({ error: "invalid_code" }, { status: 403 });
  }
  const path = String(body.path ?? "");
  if (!PATH_RE.test(path)) return Response.json({ error: "bad_path" }, { status: 400 });

  const sb = admin();
  const [folder, file] = path.split("/");
  const { data: listed } = await sb.storage.from(BUCKET).list(folder, { search: file, limit: 5 });
  const obj = listed?.find((o) => o.name === file);
  if (!obj) return Response.json({ error: "not_found" }, { status: 404 });

  const name = String(body.name ?? "").slice(0, 200);
  const guest = String(body.guest ?? "").trim().slice(0, 80) || null;
  const message = String(body.message ?? "").trim().slice(0, 500) || null;
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  const { error } = await sb.from("wedding_uploads").upsert(
    {
      storage_path: path,
      original_name: name || null,
      mime_type: meta.mimetype ?? resolveType(name, String(body.type ?? "")) ?? "application/octet-stream",
      size_bytes: meta.size ?? Number(body.size) ?? 0,
      guest_name: guest,
      message,
    },
    { onConflict: "storage_path", ignoreDuplicates: true },
  );
  if (error) return Response.json({ error: "db" }, { status: 500 });
  return Response.json({ ok: true });
}
