"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "queued" | "signing" | "uploading" | "done" | "error";
type Item = { id: string; file: File; status: Status; progress: number; error?: string };

const CONCURRENCY = 3;
const MAX_RETRIES = 3;

const ERRORS: Record<string, [string, string]> = {
  unsupported_type: ["Tipo de archivo no permitido", "File type not allowed"],
  too_large: ["Archivo demasiado grande (máx. 500 MB video, 100 MB foto)", "File too large (max 500 MB video, 100 MB photo)"],
  invalid_code: ["Enlace no válido", "Invalid link"],
  rate_limited: ["Demasiados intentos, espera un momento", "Too many attempts, please wait"],
  network: ["Sin conexión. Toca “Reintentar”", "Connection problem. Tap “Retry”"],
  server: ["Error del servidor. Toca “Reintentar”", "Server error. Tap “Retry”"],
};

class Fatal extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function putWithProgress(url: string, file: File, contentType: string, anonKey: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    if (anonKey) xhr.setRequestHeader("apikey", anonKey);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`http_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.send(file);
  });
}

function Bi({ es, en, className = "" }: { es: string; en: string; className?: string }) {
  return (
    <span className={`block ${className}`}>
      <span className="block">{es}</span>
      <span className="block text-[0.8em] opacity-70">{en}</span>
    </span>
  );
}

export default function UploadForm({ code, anonKey }: { code: string; anonKey: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [guest, setGuest] = useState("");
  const guestRef = useRef("");
  const [message, setMessage] = useState("");
  const messageRef = useRef("");
  const running = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  const uploadOne = useCallback(
    async (item: Item) => {
      const { file, id } = item;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          patch(id, { status: "signing", progress: 0, error: undefined });
          const r = await fetch("/api/upload-url", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, files: [{ name: file.name, type: file.type, size: file.size }] }),
          });
          if (r.status === 403) throw new Fatal("invalid_code");
          if (r.status === 429) throw new Fatal("rate_limited");
          if (!r.ok) throw new Error("server");
          const res = (await r.json()).results?.[0];
          if (!res) throw new Error("server");
          if (res.error === "unsupported_type" || res.error === "too_large") throw new Fatal(res.error);
          if (res.error) throw new Error("server");

          patch(id, { status: "uploading", progress: 0 });
          await putWithProgress(res.signedUrl, file, res.contentType, anonKey, (p) => patch(id, { progress: p }));

          for (let k = 0; k < 3; k++) {
            const c = await fetch("/api/complete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code, path: res.path, name: file.name, type: file.type, size: file.size, guest: guestRef.current, message: messageRef.current }),
            }).catch(() => null);
            if (c?.ok) break;
            await sleep(1000);
          }
          patch(id, { status: "done", progress: 1 });
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "network";
          if (e instanceof Fatal || attempt === MAX_RETRIES) {
            patch(id, { status: "error", error: ERRORS[msg] ? msg : msg.startsWith("http") ? "server" : "network" });
            return;
          }
          await sleep(1500 * 2 ** attempt);
        }
      }
    },
    [code, anonKey, patch],
  );

  // Simple pool: keep up to CONCURRENCY uploads running.
  useEffect(() => {
    const active = items.filter((i) => i.status === "signing" || i.status === "uploading").length;
    let slots = CONCURRENCY - active;
    for (const item of items) {
      if (slots <= 0) break;
      if (item.status === "queued" && !running.current.has(item.id)) {
        running.current.add(item.id);
        slots--;
        void uploadOne(item).finally(() => running.current.delete(item.id));
      }
    }
  }, [items, uploadOne]);

  // Warn before leaving while uploads are in progress.
  const busy = items.some((i) => i.status === "queued" || i.status === "signing" || i.status === "uploading");
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, status: "queued" as Status, progress: 0 })),
    ]);
  }

  function retry(id: string) {
    patch(id, { status: "queued", progress: 0, error: undefined });
  }

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <header className="text-center">
        <h1 className="serif text-4xl">Julieta &amp; Graham</h1>
        <p className="mt-4 text-lg leading-snug">
          <Bi
            es="¡Gracias por celebrar con nosotros! Comparte tus fotos y videos de la boda."
            en="Thank you for celebrating with us! Share your wedding photos and videos."
          />
        </p>
      </header>

      <div className="mt-8">
        <label className="block text-sm">
          <Bi es="Tu nombre (opcional)" en="Your name (optional)" />
          <input
            value={guest}
            onChange={(e) => {
              setGuest(e.target.value);
              guestRef.current = e.target.value;
            }}
            maxLength={80}
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-base"
          />
        </label>

        <label className="mt-4 block text-sm">
          <Bi es="Un mensaje para los novios (opcional)" en="A message for the couple (optional)" />
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              messageRef.current = e.target.value;
            }}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-base"
          />
        </label>

        <input ref={inputRef} type="file" multiple accept="image/*,video/*" onChange={onPick} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-5 text-center text-lg font-medium text-white active:opacity-90"
        >
          <Bi es="Elegir fotos y videos" en="Choose photos & videos" />
        </button>
        <p className="mt-3 text-center text-xs opacity-70">
          Mantén esta página abierta hasta que termine · Keep this page open until it finishes
        </p>
      </div>

      {items.length > 0 && (
        <section className="mt-8">
          <p className="text-center font-medium">
            {done} / {items.length} ✓{failed > 0 && <span className="text-red-700"> · {failed} ✗</span>}
          </p>
          {!busy && failed === 0 && (
            <p className="mt-2 text-center">
              <Bi es="¡Listo! Gracias 💛" en="All done! Thank you 💛" />
            </p>
          )}
          <ul className="mt-4 space-y-2">
            {items.map((i) => (
              <li key={i.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{i.file.name}</span>
                  <span className="shrink-0">
                    {i.status === "done" && "✓"}
                    {i.status === "queued" && "…"}
                    {(i.status === "signing" || i.status === "uploading") && `${Math.round(i.progress * 100)}%`}
                    {i.status === "error" && (
                      <button className="text-[var(--accent)] underline" onClick={() => retry(i.id)}>
                        Reintentar / Retry
                      </button>
                    )}
                  </span>
                </div>
                {(i.status === "uploading" || i.status === "signing") && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/10">
                    <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${i.progress * 100}%` }} />
                  </div>
                )}
                {i.status === "error" && i.error && (
                  <p className="mt-1 text-xs text-red-700">
                    {ERRORS[i.error]?.[0]} · {ERRORS[i.error]?.[1]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
