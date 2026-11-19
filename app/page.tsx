import { Suspense } from "react";
import UploadForm from "./UploadForm";
import { eventCodeOk } from "@/lib/storage";


async function Gate({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { c } = await searchParams;
  const code = Array.isArray(c) ? c[0] : c;

  if (!eventCodeOk(code)) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="serif text-3xl">Enlace no válido</h1>
        <p className="mt-2 text-sm opacity-70">Invalid link</p>
        <p className="mt-6">Por favor escanea de nuevo el código QR de la boda.</p>
        <p className="text-sm opacity-70">Please scan the wedding QR code again.</p>
      </main>
    );
  }

  return <UploadForm code={code!} anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""} />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="px-6 py-20 text-center opacity-60">…</main>}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}
