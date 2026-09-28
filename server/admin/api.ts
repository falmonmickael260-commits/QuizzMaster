// API d'administration des questions — servie par le serveur Node (même process que le jeu).
// Authentification : en-tête « x-admin-key » égal à ADMIN_PASSWORD.

import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { QuestionStore, QuestionInput } from "../store/types";
import { validateQuestionInput } from "../store/validate";
import { generateQuestions, generationAvailable } from "./generate";
import { CATEGORIES } from "../../shared/categories";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "admin");

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit = 5_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("Requête trop volumineuse");
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function authorized(req: IncomingMessage): boolean {
  if (!ADMIN_PASSWORD) return false;
  const given = String(req.headers["x-admin-key"] ?? "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createAdminHandler(store: QuestionStore) {
  return async function handle(req: IncomingMessage, res: ServerResponse, pathname: string, query: URLSearchParams): Promise<boolean> {
    if (!pathname.startsWith("/api/admin")) return false;
    if (!authorized(req)) {
      send(res, 401, { error: ADMIN_PASSWORD ? "Mot de passe admin invalide" : "ADMIN_PASSWORD non configuré sur le serveur" });
      return true;
    }
    const route = pathname.replace(/^\/api\/admin/, "") || "/";
    try {
      if (route === "/info" && req.method === "GET") {
        send(res, 200, { store: store.kind, generation: generationAvailable(), categories: CATEGORIES, summary: await store.summary() });
        return true;
      }
      if (route === "/questions" && req.method === "GET") {
        const page = await store.list({
          search: query.get("search") || undefined,
          category: query.get("category") || undefined,
          difficulty: query.get("difficulty") ? Number(query.get("difficulty")) : undefined,
          status: (query.get("status") as QuestionInput["status"]) || undefined,
          sort: (query.get("sort") as never) || undefined,
          offset: Number(query.get("offset") || 0),
          limit: Number(query.get("limit") || 50),
        });
        send(res, 200, page);
        return true;
      }
      if (route === "/questions" && req.method === "POST") {
        const input = validateQuestionInput(await readJson(req)) as QuestionInput;
        send(res, 201, await store.create({ ...input, source: input.source ?? "admin" }));
        return true;
      }
      const m = route.match(/^\/questions\/([^/]+)$/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        if (req.method === "GET") {
          const q = await store.get(id);
          send(res, q ? 200 : 404, q ?? { error: "Introuvable" });
        } else if (req.method === "PATCH" || req.method === "PUT") {
          const patch = validateQuestionInput(await readJson(req), true);
          send(res, 200, await store.update(id, patch));
        } else if (req.method === "DELETE") {
          await store.remove(id);
          send(res, 200, { ok: true });
        } else send(res, 405, { error: "Méthode non autorisée" });
        return true;
      }
      if (route === "/import" && req.method === "POST") {
        const body = (await readJson(req)) as { questions?: unknown[]; status?: string };
        const list = Array.isArray(body) ? body : body.questions;
        if (!Array.isArray(list)) throw new Error("Format attendu : { questions: [...] } ou un tableau JSON");
        const status = body && !Array.isArray(body) && body.status === "published" ? "published" : "draft";
        const imported: string[] = [];
        const errors: { index: number; error: string }[] = [];
        for (let i = 0; i < list.length; i++) {
          try {
            const input = validateQuestionInput(list[i]) as QuestionInput;
            const q = await store.create({ ...input, status: input.status ?? status, source: "import" });
            imported.push(q.id);
          } catch (e) {
            errors.push({ index: i, error: (e as Error).message });
          }
        }
        send(res, 200, { imported: imported.length, errors });
        return true;
      }
      if (route === "/generate" && req.method === "POST") {
        if (!generationAvailable()) throw new Error("Génération IA indisponible : définissez ANTHROPIC_API_KEY sur le serveur.");
        const body = (await readJson(req)) as { category: string; difficulty: number; count: number; theme?: string };
        const existing = (await store.list({ category: body.category, limit: 500 })).items;
        const { created, rejected } = await generateQuestions({ ...body, existing });
        const saved = [];
        for (const c of created) saved.push(await store.create(c));
        send(res, 200, { created: saved, rejected });
        return true;
      }
      send(res, 404, { error: "Route inconnue" });
    } catch (e) {
      send(res, 400, { error: (e as Error).message });
    }
    return true;
  };
}
