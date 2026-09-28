import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { AnswerMode } from "../../shared/config";
import { emptyStats, type Question } from "../../shared/types";
import { SEED_QUESTIONS } from "../../data/questions";
import type { QuestionFilter, QuestionInput, QuestionPage, QuestionStore } from "./types";
import { applyFilter, summarize } from "./common";

interface FileShape {
  version: 1;
  questions: Question[];
  /** Questions de la base initiale supprimées volontairement (pour ne pas les réimporter). */
  deletedSeedIds: string[];
}

/**
 * Stockage local (fichier JSON) — utilisé quand Supabase n'est pas configuré.
 * La base initiale de questions est chargée au premier démarrage, puis toute modification est persistée.
 */
export class FileQuestionStore implements QuestionStore {
  readonly kind = "file" as const;
  private questions = new Map<string, Question>();
  private deletedSeedIds = new Set<string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();

  constructor(private file = path.resolve(process.cwd(), "data/store/questions.json"), private persist = true) {}

  async init() {
    let data: FileShape | null = null;
    if (this.persist) {
      try {
        data = JSON.parse(await fs.readFile(this.file, "utf8")) as FileShape;
      } catch {
        data = null;
      }
    }
    if (data) {
      data.questions.forEach((q) => this.questions.set(q.id, q));
      data.deletedSeedIds?.forEach((id) => this.deletedSeedIds.add(id));
    }
    // Ajoute les questions de la base initiale qui ne sont pas encore présentes.
    const now = new Date().toISOString();
    let added = 0;
    for (const s of SEED_QUESTIONS) {
      if (this.questions.has(s.id) || this.deletedSeedIds.has(s.id)) continue;
      this.questions.set(s.id, { ...s, status: "published", source: "seed", createdAt: now, updatedAt: now, stats: emptyStats() });
      added++;
    }
    if (added) this.scheduleSave(0);
  }

  async list(filter: QuestionFilter): Promise<QuestionPage> {
    return applyFilter([...this.questions.values()], filter);
  }

  async get(id: string) {
    return this.questions.get(id) ?? null;
  }

  async create(input: QuestionInput) {
    const now = new Date().toISOString();
    const id = input.id && !this.questions.has(input.id) ? input.id : `${input.category}-${crypto.randomBytes(5).toString("hex")}`;
    const q: Question = {
      id,
      question: input.question,
      category: input.category,
      difficulty: input.difficulty,
      correctAnswer: input.correctAnswer,
      acceptedAnswers: input.acceptedAnswers ?? [],
      wrongAnswers: input.wrongAnswers,
      explanation: input.explanation,
      status: input.status ?? "draft",
      source: input.source ?? "admin",
      createdAt: now,
      updatedAt: now,
      stats: emptyStats(),
    };
    this.questions.set(id, q);
    this.scheduleSave();
    return q;
  }

  async update(id: string, patch: Partial<QuestionInput>) {
    const q = this.questions.get(id);
    if (!q) throw new Error("Question introuvable");
    const { id: _ignored, ...rest } = patch;
    const next: Question = { ...q, ...rest, updatedAt: new Date().toISOString() } as Question;
    this.questions.set(id, next);
    this.scheduleSave();
    return next;
  }

  async remove(id: string) {
    const q = this.questions.get(id);
    if (!q) return;
    this.questions.delete(id);
    if (q.source === "seed") this.deletedSeedIds.add(id);
    this.scheduleSave();
  }

  async getPlayablePool() {
    return [...this.questions.values()].filter((q) => q.status === "published");
  }

  async recordUsage(ids: string[]) {
    for (const id of ids) {
      const q = this.questions.get(id);
      if (q) q.stats.timesUsed++;
    }
    this.scheduleSave();
  }

  async recordAnswers(id: string, results: { mode: AnswerMode | null; correct: boolean }[]) {
    const q = this.questions.get(id);
    if (!q) return;
    for (const r of results) {
      if (!r.mode) {
        q.stats.timeouts++;
        continue;
      }
      q.stats.answers++;
      q.stats.byMode[r.mode].answers++;
      if (r.correct) {
        q.stats.correct++;
        q.stats.byMode[r.mode].correct++;
      }
    }
    this.scheduleSave();
  }

  async summary() {
    return summarize([...this.questions.values()]);
  }

  private scheduleSave(delay = 1000) {
    if (!this.persist) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saving = this.saving.then(() => this.writeFile()).catch((e) => console.error("[store] sauvegarde impossible", e));
    }, delay);
  }

  private async writeFile() {
    const data: FileShape = { version: 1, questions: [...this.questions.values()], deletedSeedIds: [...this.deletedSeedIds] };
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data));
    await fs.rename(tmp, this.file);
  }

  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      await this.writeFile();
    }
    await this.saving;
  }
}
