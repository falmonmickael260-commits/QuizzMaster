// Serveur BLIND QUIZZ : Next.js (interface) + WebSocket (jeu temps réel autoritaire) + API admin, sur un seul port.

import http from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { WebSocketServer } from "ws";
import { createQuestionStore } from "./store";
import { RoomManager } from "./game/rooms";
import { createAdminHandler } from "./admin/api";
import { TIMINGS } from "../shared/config";

const dev = process.env.NODE_ENV !== "production";
// Charge .env, .env.local… comme Next.js (SUPABASE_URL, ADMIN_PASSWORD, etc.)
loadEnvConfig(process.cwd(), dev);
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || "0.0.0.0";

async function main() {
  const store = await createQuestionStore();
  const summary = await store.summary();
  console.log(`[blind-quizz] stockage : ${store.kind} — ${summary.published} questions publiées (${summary.total} au total)`);

  const app = next({ dev, dir: process.cwd() });
  const handle = app.getRequestHandler();
  await app.prepare();
  const upgradeNext = app.getUpgradeHandler();

  // BQ_TIME_SCALE (défaut 1) ralentit toutes les phases — réservé aux démos et captures d'écran.
  const scale = Math.max(0.1, Number(process.env.BQ_TIME_SCALE || 1));
  const timings = Object.fromEntries(Object.entries(TIMINGS).map(([k, v]) => [k, Math.round(v * scale)])) as typeof TIMINGS;
  if (scale !== 1) console.warn(`[blind-quizz] ⚠ BQ_TIME_SCALE=${scale} : durées modifiées (mode démo)`);
  const rooms = new RoomManager(store, timings);
  const admin = createAdminHandler(store);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.roomCount, store: store.kind }));
      return;
    }
    if (await admin(req, res, url.pathname, url.searchParams)) return;
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  wss.on("connection", (ws) => rooms.attach(ws));
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url || "/", "http://localhost");
    if (pathname === "/ws") wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    else upgradeNext(req, socket, head);
  });

  server.listen(port, hostname, () => {
    console.log(`[blind-quizz] prêt sur http://localhost:${port} (${dev ? "dev" : "production"})`);
  });

  const shutdown = async () => {
    rooms.dispose();
    const s = store as { flush?: () => Promise<void> };
    await s.flush?.();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
