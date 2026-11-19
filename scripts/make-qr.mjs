// Usage: node scripts/make-qr.mjs https://your-domain.com
import QRCode from "qrcode";
import { writeFile } from "node:fs/promises";

const base = process.argv[2];
if (!base) {
  console.error("Usage: node scripts/make-qr.mjs https://your-domain.com");
  process.exit(1);
}
const code = process.env.EVENT_CODE ?? "julietaygraham";
const url = `${base.replace(/\/$/, "")}/?c=${encodeURIComponent(code)}`;

await QRCode.toFile("qr.png", url, { width: 1600, margin: 4, errorCorrectionLevel: "H" });
await writeFile("qr.svg", await QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: "H" }));
console.log(`QR for ${url}\nWrote qr.png and qr.svg`);
