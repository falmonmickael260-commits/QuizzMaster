// Captures du plateau en mode démo (?demo=<phase>) pour vérifier la mise en scène.
// Usage : node scripts/shoot-demo.mjs [dossier] [largeur] [hauteur] [phases...]
import { chromium } from "playwright";
import fs from "node:fs";
const [out = "e2e/screenshots/demo", w = "1280", h = "720", ...phases] = process.argv.slice(2);
const list = phases.length ? phases : ["attract", "question", "reveal", "leaderboard", "wheel", "final"];
const waits = { attract: 9000, question: 7000, reveal: 3500, leaderboard: 4500, wheel: 6000, final: 9000 };
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const phase of list) {
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
  page.on("pageerror", (e) => console.log(`[${phase}] ${e.message}`));
  const q = phase === "attract" ? "" : `demo=${phase}&`;
  await page.goto(`${process.env.BASE_URL || "http://localhost:3000"}/?${q}quality=${process.env.QUALITY || "high"}&fps=${process.env.FPS || 4}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForTimeout(waits[phase] ?? 6000);
  await page.screenshot({ path: `${out}/${phase}-${w}x${h}.png`, timeout: 120000 });
  console.log("ok", phase);
  await page.close();
}
await browser.close();
