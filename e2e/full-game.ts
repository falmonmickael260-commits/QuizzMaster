// Test de bout en bout : une vraie partie BLIND QUIZZ avec 2 navigateurs + 2 bots WebSocket.
// Vérifie le parcours complet (lobby → questions → classement → roue → cible → nouvelle manche → finale)
// et la synchronisation entre joueurs. Nécessite un serveur lancé (npm run dev) sur BASE_URL.
//
//   BASE_URL=http://localhost:3000 SHOTS=./e2e/screenshots npx tsx e2e/full-game.ts

import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";
import WebSocket from "ws";
import { SEED_QUESTIONS } from "../data/questions";
import type { PrivateState, PublicRoomState, ServerMessage } from "../shared/types";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = path.resolve(process.env.SHOTS || "e2e/screenshots");
const ROUNDS = Number(process.env.ROUNDS || 2);
/** Captures supplémentaires pendant les phases courtes (à utiliser avec BQ_TIME_SCALE côté serveur). */
const SLOW_SHOTS = process.env.SLOW_SHOTS === "1";
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
fs.mkdirSync(SHOTS, { recursive: true });

const answers = new Map(SEED_QUESTIONS.map((q) => [q.question, q]));
const log = (...a: unknown[]) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const failures: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) log("  ✔", msg);
  else {
    log("  ✘", msg);
    failures.push(msg);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Bots WebSocket ──────────────────────────────────────────────────────────

class Bot {
  ws: WebSocket;
  state: PublicRoomState | null = null;
  priv: PrivateState | null = null;
  id = "";
  acted = new Set<number>();
  constructor(public name: string, code: string, public strategy: (qi: number) => { mode: "4" | "2" | "solo" | null; correct: boolean }) {
    const url = BASE.replace(/^http/, "ws") + "/ws";
    this.ws = new WebSocket(url);
    this.ws.on("open", () => this.ws.send(JSON.stringify({ t: "join", code, name, character: ["maya", "leo", "karim", "zoe"][name.length % 4] })));
    this.ws.on("message", (raw) => this.onMsg(JSON.parse(raw.toString()) as ServerMessage));
  }
  private onMsg(m: ServerMessage) {
    if (m.t === "welcome") {
      this.id = m.playerId;
      this.state = m.state;
    } else if (m.t === "state") this.state = m.state;
    else if (m.t === "private") this.priv = m.private;
    else if (m.t === "error" && !/Temps|verrouill|déjà/.test(m.message)) log(`  [bot ${this.name}] erreur serveur : ${m.message}`);
    this.maybeAct();
  }
  private maybeAct() {
    const s = this.state;
    if (!s) return;
    if (s.phase === "question" && s.question?.text && !this.acted.has(s.question.index)) {
      const qi = s.question.index;
      this.acted.add(qi);
      const { mode, correct } = this.strategy(qi);
      if (!mode) return;
      const seed = answers.get(s.question.text);
      setTimeout(() => this.ws.send(JSON.stringify({ t: "mode", mode })), 800 + Math.random() * 2000);
      setTimeout(() => {
        const opts = this.priv?.options ?? [];
        let value = correct ? seed?.correctAnswer ?? "?" : "réponse fausse";
        if (mode !== "solo") value = correct ? (seed?.correctAnswer ?? opts[0]) : opts.find((o) => o !== seed?.correctAnswer) ?? opts[0];
        this.ws.send(JSON.stringify({ t: "answer", value }));
      }, 3500 + Math.random() * 3000);
    }
    const w = s.wheel;
    if (s.phase === "wheel" && w?.spinnerId === this.id) {
      if (w.stage === "waiting_spin" && !this.acted.has(-100 - s.round)) {
        this.acted.add(-100 - s.round);
        setTimeout(() => this.ws.send(JSON.stringify({ t: "spin" })), 1500);
      }
      if (w.stage === "choose_target" && !this.acted.has(-200 - s.round)) {
        this.acted.add(-200 - s.round);
        const target = s.players.find((p) => p.id !== this.id)!;
        setTimeout(() => this.ws.send(JSON.stringify({ t: "target", playerId: target.id })), 2000);
      }
    }
  }
  close() {
    this.ws.close();
  }
}

// ─── Aides navigateur ────────────────────────────────────────────────────────

async function getState(page: Page): Promise<PublicRoomState | null> {
  // tolérant aux rechargements de page (la session est reprise automatiquement)
  return page
    .evaluate(() => (window as unknown as { __BQ?: { getState: () => { state: PublicRoomState | null } } }).__BQ?.getState().state ?? null)
    .catch(() => null);
}
async function getMyId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as unknown as { __BQ: { getState: () => { playerId: string | null } } }).__BQ.getState().playerId);
}
async function waitFor(page: Page, pred: (s: PublicRoomState) => boolean, label: string, timeout = 60_000): Promise<PublicRoomState> {
  const start = Date.now();
  for (;;) {
    const s = await getState(page);
    if (s && pred(s)) return s;
    if (Date.now() - start > timeout) throw new Error(`Timeout en attendant : ${label} (phase=${s?.phase}, stage=${s?.wheel?.stage})`);
    await sleep(250);
  }
}
async function shot(page: Page, name: string) {
  // un seul onglet est « au premier plan » dans Chromium headless : on l'active avant la capture
  await page.bringToFront();
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), timeout: 90_000 });
  log(`  📸 ${name}.png`);
}

type Plan = { mode: "4" | "2" | "solo" | null; correct: boolean };

/** Joue une question dans le navigateur, via le panneau de question (choix de l'aide puis réponse). */
async function playInBrowser(page: Page, plan: Plan, s: PublicRoomState) {
  if (!plan.mode) return;
  const seed = answers.get(s.question!.text)!;
  const idx = { "2": 0, "4": 1, solo: 2 }[plan.mode]; // ordre des boutons : 2 · 4 · SOLO
  await page.locator(".tv-mode:visible").nth(idx).click({ timeout: 8000, force: true });
  if (plan.mode === "solo") {
    const input = page.locator(".tv-solo input");
    await input.waitFor({ timeout: 8000 });
    // saisie volontairement « sale » pour vérifier la tolérance (minuscules, sans accents)
    const typed = plan.correct ? seed.correctAnswer.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "zzz mauvaise";
    await input.fill(typed);
    await input.press("Enter");
  } else {
    await page.locator(".tv-answer").first().waitFor({ timeout: 8000 });
    const texts = await page.locator(".tv-answer").allInnerTexts();
    const clean = texts.map((t) => t.replace(/^[A-D]\s*/, "").trim());
    const wanted = plan.correct ? clean.findIndex((t) => t === seed.correctAnswer) : clean.findIndex((t) => t !== seed.correctAnswer);
    await page.locator(".tv-answer").nth(Math.max(0, wanted)).click({ force: true });
  }
}

// ─── Scénario ────────────────────────────────────────────────────────────────

async function main() {
  // Deux navigateurs distincts, comme deux vrais joueurs (chacun son processus de rendu).
  const launch = () =>
    chromium.launch({
      executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
    });
  const browserA = await launch();
  const browserB = await launch();
  const ctxA = await browserA.newContext({ viewport: { width: 1280, height: 720 } });
  const ctxB = await browserB.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  for (const [n, p] of [["A", A], ["B", B]] as const) p.on("pageerror", (e) => log(`  [page ${n}] ${e.message}`));

  log("1. LOBBY — Alex crée la partie");
  await A.goto(`${BASE}/?quality=${process.env.QUALITY || "high"}&fps=${process.env.FPS || 6}`, { waitUntil: "networkidle", timeout: 180_000 });
  await A.fill("#pseudo", "Alex", { timeout: 180_000 });
  await A.locator(".menu-rounds button").nth(ROUNDS - 1).click({ force: true });
  await A.click("text=Créer une émission", { force: true });
  const lobby = await waitFor(A, (s) => s.phase === "lobby", "création de la room");
  const code = lobby.code;
  check(/^BQ-\d{4}$/.test(code), `code de room au format BQ-XXXX (${code})`);
  check(lobby.settings.rounds === ROUNDS, `${ROUNDS} manches configurées`);

  log("2. CHOIX DU PERSONNAGE — Sarah rejoint sur smartphone, 2 bots rejoignent");
  await B.goto(`${BASE}/?room=${code}&quality=low&fps=${process.env.FPS || 6}`, { waitUntil: "networkidle", timeout: 180_000 });
  await B.fill("#pseudo", "Sarah", { timeout: 180_000 });
  await B.locator(".menu-face").nth(6).click({ force: true });
  // personnalisation : un casque sur le personnage (code personnalisé validé par le serveur)
  await B.click('button[aria-label="Accessoire"]', { force: true });
  await B.click('.menu-chips button:has-text("Casque")', { force: true });
  await B.click(".menu-cta.teal", { force: true });
  const botPlans: Record<string, (qi: number) => Plan> = {
    Lucas: () => ({ mode: "2", correct: Math.random() < 0.5 }),
    Emma: (qi) => (qi < 2 ? { mode: null, correct: false } : { mode: "2", correct: Math.random() < 0.5 }),
  };
  const bots = [new Bot("Lucas", code, botPlans.Lucas), new Bot("Emma", code, botPlans.Emma)];
  const full = await waitFor(A, (s) => s.players.length === 4, "4 candidats");
  check(full.players.map((p) => p.seat).sort().join() === "0,1,2,3", "chaque candidat a son propre pupitre (sièges 0-3)");
  const seatsAtStart = Object.fromEntries(full.players.map((p) => [p.id, p.seat]));
  check(full.players.find((p) => p.name === "Sarah")?.character.startsWith("c-") ?? false, "personnage personnalisé accepté par le serveur (code c-…)");
  const idA = (await getMyId(A))!;
  const idB = (await getMyId(B))!;
  await sleep(2500);
  await shot(A, "01-lobby-4-candidats");
  await shot(B, "01b-lobby-mobile");

  log("3. ARRIVÉE SUR LE PLATEAU — lancement de l'émission");
  await A.click("text=Lancer l'émission", { force: true });
  const intro = await waitFor(A, (s) => s.phase !== "lobby", "générique");
  check(["intro", "round_intro", "question"].includes(intro.phase), `l'émission démarre (${intro.phase})`);
  if (SLOW_SHOTS) {
    await shot(A, "02-generique");
    await waitFor(A, (s) => s.phase === "round_intro", "annonce de manche");
    await shot(A, "03-manche-1");
  }

  const plansA: Plan[] = [
    { mode: "solo", correct: true },
    { mode: "2", correct: true },
    { mode: "4", correct: false },
    { mode: null, correct: false }, // laisse expirer les 12 s
    { mode: "solo", correct: true }, // Alex remporte la manche (450 pts) et tourne la roue
  ];
  const plansB: Plan[] = [
    { mode: "4", correct: true },
    { mode: "solo", correct: false },
    { mode: "2", correct: true },
    { mode: "4", correct: true },
    { mode: "2", correct: false },
  ];

  const total = ROUNDS * 5;
  for (let qi = 0; qi < total; qi++) {
    const inRound = qi % 5;
    const round = Math.floor(qi / 5) + 1;
    log(`4. QUESTION ${qi + 1}/${total} (manche ${round})`);
    await waitFor(A, (s) => (s.phase === "question" && s.question?.index === qi) || (s.question?.index ?? -1) > qi, `question ${qi + 1}`, 90_000);
    if (qi === 0 && SLOW_SHOTS) await shot(A, "04-annonce-question");
    const s = await waitFor(A, (st) => st.phase === "question" && !!st.question?.text && st.question.index === qi, "chrono démarré");
    const before = Object.fromEntries(s.players.map((p) => [p.id, p.score]));
    check(!!answers.get(s.question!.text), `question issue de la base (« ${s.question!.text.slice(0, 50)}… »)`);
    const pa = round === 1 ? plansA[inRound] : { mode: (["4", "2", "solo"] as const)[qi % 3], correct: qi % 2 === 0 };
    const pb = round === 1 ? plansB[inRound] : { mode: "solo" as const, correct: true };
    const t0 = Date.now();
    await Promise.all([playInBrowser(A, pa, s), playInBrowser(B, pb, s)]);
    if (qi === 0) await shot(A, `05-question-${qi + 1}-mode-${pa.mode}`);
    if (qi === 1) await shot(B, `05b-question-${qi + 1}-mobile`);
    if (qi === 3) await shot(A, "06-question-4-sans-reponse");
    const r = await waitFor(A, (st) => st.phase === "reveal" && st.reveal?.questionIndex === qi, "révélation", 30_000);
    log(`  réponses verrouillées après ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const resA = r.reveal!.results[idA];
    const resB = r.reveal!.results[idB];
    const mult = (id: string) => r.players.find((p) => p.id === id)!.modifiers.pointsMultiplier;
    const expected = (pl: Plan, id: string) => (pl.mode && pl.correct ? Math.round({ "2": 50, "4": 100, solo: 200 }[pl.mode] * mult(id)) : 0);
    check(resA.points === expected(pa, idA), `Alex (${pa.mode ?? "aucun"}, ${pa.correct ? "bonne" : "mauvaise"}) → ${resA.points} pts (attendu ${expected(pa, idA)})`);
    check(resB.points === expected(pb, idB), `Sarah (${pb.mode ?? "aucun"}, ${pb.correct ? "bonne" : "mauvaise"}) → ${resB.points} pts (attendu ${expected(pb, idB)})`);
    if (!pa.mode) check(resA.timedOut, "sans réponse : temps écoulé, aucun point");
    for (const p of r.players) check(p.score === before[p.id] + r.reveal!.results[p.id].points, `score de ${p.name} mis à jour (${before[p.id]} → ${p.score})`);
    const sB = await waitFor(B, (st) => st.phase === "reveal" && st.reveal?.questionIndex === qi, "révélation côté Sarah", 10_000);
    check(JSON.stringify(sB.players.map((p) => [p.id, p.score])) === JSON.stringify(r.players.map((p) => [p.id, p.score])), "scores identiques chez Alex et Sarah (synchronisation)");
    check(r.players.every((p) => p.seat === seatsAtStart[p.id]), "les pupitres n'ont pas bougé");
    if (qi === 0) await shot(A, "07-revelation-reponse");
    if (qi === 4) await shot(A, "08-reaction-candidats");
    if (qi === 2) await shot(B, "08b-revelation-mobile");

    if (inRound === 4) {
      log(`5. CLASSEMENT — fin de la manche ${round}`);
      const lb = await waitFor(A, (st) => st.phase === "leaderboard" || st.phase === "final", "classement", 20_000);
      if (lb.phase === "final") break;
      if (round === 1) await shot(A, `09-classement-manche-${round}`);
      check(lb.ranking.length === 4 && lb.players.length === 4, "classement complet, personne n'est éliminé");

      log("6. ROUE BONUS / MALUS");
      const wh = await waitFor(A, (st) => st.phase === "wheel" && !!st.wheel, "roue prête", 20_000);
      const spinner = wh.players.find((p) => p.id === wh.wheel!.spinnerId)!;
      const best = [...wh.players].sort((a, b) => b.roundScore - a.roundScore)[0];
      check(spinner.roundScore === best.roundScore, `${spinner.name} (meilleur de la manche, ${spinner.roundScore} pts) tourne la roue`);
      const page = spinner.id === idA ? A : spinner.id === idB ? B : null;
      if (page) {
        await waitFor(A, (st) => st.wheel?.stage === "waiting_spin", "attente du lancer", 10_000);
        await page.click("text=Lancer la roue", { timeout: 10_000, force: true });
        const launched = await waitFor(A, (st) => st.wheel?.stage !== "waiting_spin", "lancer pris en compte", 10_000);
        check(!!launched.wheel?.spinStartedAt, "le gagnant a lancé la roue lui-même");
      }
      const spin = await waitFor(A, (st) => st.wheel?.stage !== "intro" && st.wheel?.stage !== "waiting_spin", "roue qui tourne", 25_000);
      check(spin.wheel?.resultIndex !== null, "le serveur a tiré le résultat de la roue");
      if (spin.wheel?.stage === "spinning" && round === 1) await shot(A, `11-roue-tourne-manche-${round}`);
      const after = await waitFor(A, (st) => st.wheel?.stage === "choose_target" || st.wheel?.stage === "result", "résultat de la roue", 20_000);
      // scores de fin de manche = scores avant la roue
      const beforeWheel = Object.fromEntries(lb.players.map((p) => [p.id, p.score]));
      if (after.wheel!.stage === "choose_target") {
        log("7. CHOIX D'UNE CIBLE");
        if (round === 1) await shot(A, `12-choix-cible-manche-${round}`);
        if (page) {
          const btn = page.locator(".targets button").first();
          await btn.click({ timeout: 10_000, force: true });
        }
      }
      const res = await waitFor(A, (st) => st.wheel?.stage === "result", "effet appliqué", 25_000);
      log(`  effet : ${res.wheel!.outcome!.text}`);
      const changes = res.wheel!.outcome!.scoreChanges;
      for (const p of res.players) check(p.score === Math.max(0, (beforeWheel[p.id] ?? p.score) + (changes[p.id] ?? 0)), `score de ${p.name} cohérent après la roue (${p.score})`);
      if (round === 1) await shot(A, `13-effet-roue-manche-${round}`);
      log("8. NOUVELLE MANCHE");
      const nr = await waitFor(A, (st) => st.round === round + 1, "nouvelle manche", 25_000);
      check(nr.round === round + 1, `manche ${round + 1} lancée`);
      check(nr.players.length === 4, "tous les candidats sont toujours sur le plateau");
    }
  }

  log("9. FINALE");
  const fin = await waitFor(A, (s) => s.phase === "final", "finale", 60_000);
  await shot(A, "14-finale-classement");
  await sleep(5000);
  await shot(A, "15-finale-victoire");
  await shot(B, "15b-finale-mobile");
  const finB = await getState(B);
  check(JSON.stringify(finB?.ranking) === JSON.stringify(fin.ranking), "classement final identique chez tous les joueurs");
  check(fin.ranking[0].score === Math.max(...fin.players.map((p) => p.score)), `vainqueur : ${fin.players.find((p) => p.id === fin.ranking[0].playerId)?.name} (${fin.ranking[0].score} pts)`);
  check(fin.questionNumber === total, `${total} questions jouées`);

  bots.forEach((b) => b.close());
  await browserA.close();
  await browserB.close();
  log(failures.length ? `\n❌ ${failures.length} vérification(s) en échec :\n- ${failures.join("\n- ")}` : "\n✅ Parcours complet validé.");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
