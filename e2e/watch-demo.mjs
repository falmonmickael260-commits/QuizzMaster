// Regarde une partie de démonstration (/?partie-test) et capture l'écran à intervalles réguliers.
// Usage : node e2e/watch-demo.mjs <dossier> <largeur> <hauteur> [manches] [intervalle_ms] [qualité]
import { chromium } from "playwright";
import fs from "node:fs";

const [out = "e2e/screenshots/watch", w = "1920", h = "1080", rounds = "2", every = "7000", quality = "high"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const mobile = Number(w) < 700;
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, isMobile: mobile, hasTouch: mobile });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.log("[console]", m.text().slice(0, 200)));
await page.goto(`${process.env.BASE_URL || "http://localhost:3000"}/?partie-test&manches=${rounds}&quality=${quality}&fps=${process.env.FPS || 4}`, {
  waitUntil: "networkidle",
  timeout: 180000,
});
const state = () => page.evaluate(() => window.__BQ?.getState().state ?? null).catch(() => null);
let i = 0;
const start = Date.now();
for (;;) {
  const s = await state();
  const tag = s ? `${s.phase}${s.wheel ? "-" + s.wheel.stage : ""}-q${s.questionNumber}` : "init";
  const name = `${String(i++).padStart(3, "0")}-${tag}.png`;
  await page.screenshot({ path: `${out}/${name}`, timeout: 120000 });
  const scores = s?.players.map((p) => `${p.name}:${p.score}${p.mode ? "(" + p.mode + (p.answered ? "✓" : "") + ")" : ""}`).join(" ");
  console.log(`${((Date.now() - start) / 1000).toFixed(0)}s ${name} ${scores ?? ""}`);
  if (s?.phase === "final" && Date.now() - s.phaseStartedAt > 9000) break;
  if (Date.now() - start > 40 * 60_000) break;
  await page.waitForTimeout(Number(every));
}
await browser.close();
