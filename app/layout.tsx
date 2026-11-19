import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Julieta & Graham — Fotos y videos",
  description: "Comparte tus fotos y videos de nuestra boda · Share your photos and videos from our wedding",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#faf6f0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
