// Vérifie un serveur BLIND QUIZZ en ligne : sonde /api/health puis joue le début d'une vraie partie
// (création d'un salon, 3 candidats simulés, pilote automatique, attente de la 1re révélation).
//   node scripts/check-live.mjs https://mon-jeu.up.railway.app
import WebSocket from "ws";

const base = (process.argv[2] || "").replace(/\/+$/, "");
if (!base) {
  console.error("Usage : node scripts/check-live.mjs https://adresse-du-jeu");
  process.exit(2);
}

const health = await fetch(`${base}/api/health`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
console.log("Santé :", JSON.stringify(health));
if (!health.ok) process.exit(1);

const page = await fetch(base).then((r) => r.status).catch(() => 0);
console.log("Page d'accueil : HTTP", page);

const ws = new WebSocket(base.replace(/^http/, "ws") + "/ws");
const send = (m) => ws.send(JSON.stringify(m));
const timer = setTimeout(() => {
  console.error("✖ Délai dépassé : la partie n'a pas atteint la révélation.");
  process.exit(1);
}, 90_000);
let started = false;
ws.on("open", () => {
  console.log("WebSocket : connecté");
  send({ t: "create", name: "Controle", character: "nova", rounds: 1 });
});
ws.on("message", (raw) => {
  const m = JSON.parse(String(raw));
  if (m.t === "error") console.log("Erreur serveur :", m.message);
  const s = m.state;
  if (!s) return;
  if (m.t === "welcome") {
    console.log("Salon créé :", s.code);
    send({ t: "addBots", count: 3 });
    send({ t: "autopilot", on: true });
  }
  if (!started && s.phase === "lobby" && s.players.length >= 4) {
    started = true;
    console.log("Joueurs :", s.players.map((p) => p.name).join(", "));
    send({ t: "start" });
  }
  if (s.phase === "reveal" && s.reveal) {
    console.log(`Question ${s.questionNumber} révélée — réponse : ${s.reveal.correctAnswer}`);
    console.log("Scores :", s.players.map((p) => `${p.name} ${p.score}`).join(" · "));
    console.log("✔ Le jeu fonctionne en ligne.");
    clearTimeout(timer);
    send({ t: "leave" });
    ws.close();
    process.exit(0);
  }
});
ws.on("error", (e) => {
  console.error("✖ WebSocket :", e.message);
  process.exit(1);
});
