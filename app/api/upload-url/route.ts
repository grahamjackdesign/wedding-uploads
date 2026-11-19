import {
  BUCKET, MAX_FILES_PER_REQUEST, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES,
  admin, eventCodeOk, extOf, rateLimited, resolveType,
} from "@/lib/storage";

type Result =
  | { path: string; signedUrl: string; contentType: string }
  | { error: "unsupported_type" | "too_large" | "server" };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !eventCodeOk(body.code)) {
    return Response.json({ error: "invalid_code" }, { status: 403 });
  }
  const files: unknown[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0 || files.length > MAX_FILES_PER_REQUEST) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip, files.length)) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const sb = admin();
  const month = new Date().toISOString().slice(0, 7);
  const results: Result[] = [];

  for (const raw of files) {
    const f = (raw ?? {}) as { name?: unknown; type?: unknown; size?: unknown };
    const name = String(f.name ?? "");
    const type = resolveType(name, String(f.type ?? ""));
    const size = Number(f.size);
    if (!type || !Number.isFinite(size) || size <= 0) {
      results.push({ error: "unsupported_type" });
      continue;
    }
    const limit = type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (size > limit) {
      results.push({ error: "too_large" });
      continue;
    }
    const ext = extOf(name) || (type.startsWith("video/") ? "mp4" : "jpg");
    const path = `${month}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      results.push({ error: "server" });
      continue;
    }
    results.push({ path, signedUrl: data.signedUrl, contentType: type });
  }
  return Response.json({ results });
}
