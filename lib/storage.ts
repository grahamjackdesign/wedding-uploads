import { createClient } from "@supabase/supabase-js";

export const BUCKET = "wedding_uploads";
export const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
export const MAX_FILES_PER_REQUEST = 10;

/** Server-only client. Uses the service role key: never import this in a client component. */
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function eventCodeOk(code: unknown): boolean {
  const expected = (process.env.EVENT_CODE ?? "julietaygraham").trim().toLowerCase();
  return typeof code === "string" && code.trim().toLowerCase() === expected;
}

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v",
  webm: "video/webm", "3gp": "video/3gpp",
};

export function extOf(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "";
}

/** Some browsers send an empty MIME type for HEIC/MOV, so fall back to the extension. */
export function resolveType(name: string, type: string): string | null {
  if (type.startsWith("image/") || type.startsWith("video/")) return type;
  return EXT_TYPES[extOf(name)] ?? null;
}

// Best-effort in-memory limiter (per server instance). The event code is the real gate.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimited(ip: string, cost: number, max = 600, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: cost, reset: now + windowMs });
    return false;
  }
  h.n += cost;
  return h.n > max;
}

export const PATH_RE = /^\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;
