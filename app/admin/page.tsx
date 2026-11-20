import Link from "next/link";
import { Suspense } from "react";
import { isAdmin } from "@/lib/admin-auth";
import { BUCKET, admin } from "@/lib/storage";
import { login, logout } from "./actions";

const PAGE_SIZE = 40;

type Row = {
  id: string;
  storage_path: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  guest_name: string | null;
  message: string | null;
  created_at: string;
};

async function AdminInner({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const sp = await searchParams;

  if (!(await isAdmin())) {
    return (
      <main className="mx-auto max-w-sm px-6 py-20">
        <h1 className="serif text-2xl">Admin</h1>
        <form action={login} className="mt-6 space-y-3">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            className="w-full rounded-lg border border-black/20 bg-white px-3 py-2"
          />
          <button className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-white">Entrar</button>
          {sp.error === "1" && <p className="text-sm text-red-700">Contraseña incorrecta.</p>}
          {sp.error === "config" && <p className="text-sm text-red-700">ADMIN_PASSWORD no está configurada.</p>}
        </form>
      </main>
    );
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const sb = admin();
  const { data, count } = await sb
    .from("wedding_uploads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as Row[];

  const { data: signed } = rows.length
    ? await sb.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600)
    : { data: [] };
  const urls = new Map<string, string>();
  for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="serif text-2xl">
          Subidas · Uploads <span className="text-base opacity-60">({total})</span>
        </h1>
        <form action={logout}>
          <button className="text-sm underline">Salir</button>
        </form>
      </div>
      <p className="mt-1 text-sm opacity-70">
        Para bajar todo: <code>npm run download</code> (ver README).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {rows.map((r) => {
          const url = urls.get(r.storage_path);
          const isVideo = r.mime_type.startsWith("video/");
          const isHeic = /hei[cf]/.test(r.mime_type);
          const dl = url ? `${url}&download=${encodeURIComponent(r.original_name ?? r.storage_path)}` : undefined;
          return (
            <figure key={r.id} className="overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="aspect-square bg-black/5">
                {url && isVideo && <video src={url} controls preload="metadata" className="h-full w-full object-cover" />}
                {url && !isVideo && !isHeic && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={r.original_name ?? ""} loading="lazy" className="h-full w-full object-cover" />
                )}
                {isHeic && <div className="flex h-full items-center justify-center text-xs opacity-60">HEIC</div>}
              </div>
              <figcaption className="p-2 text-xs">
                <div className="truncate">{r.guest_name ?? "—"}</div>
                {r.message && (
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap italic" title={r.message}>
                    {r.message}
                  </div>
                )}
                <div className="opacity-60">{(r.size_bytes / 1048576).toFixed(1)} MB</div>
                {dl && (
                  <a href={dl} className="underline">
                    Descargar
                  </a>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <nav className="mt-8 flex justify-between text-sm">
        {page > 1 ? <Link href={`/admin?page=${page - 1}`}>← Anterior</Link> : <span />}
        <span className="opacity-60">
          {page} / {pages}
        </span>
        {page < pages ? <Link href={`/admin?page=${page + 1}`}>Siguiente →</Link> : <span />}
      </nav>
    </main>
  );
}

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<main className="px-6 py-20 text-center opacity-60">…</main>}>
      <AdminInner searchParams={searchParams} />
    </Suspense>
  );
}
