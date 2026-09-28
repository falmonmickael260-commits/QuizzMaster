import type { AnswerMode } from "../../shared/config";
import type { Question, QuestionStatus } from "../../shared/types";

export interface QuestionFilter {
  search?: string;
  category?: string;
  difficulty?: number;
  status?: QuestionStatus;
  sort?: "updated" | "difficulty" | "successRate" | "used" | "category";
  offset?: number;
  limit?: number;
}

export interface QuestionPage {
  total: number;
  items: Question[];
}

export type QuestionInput = Omit<Question, "id" | "createdAt" | "updatedAt" | "stats" | "source" | "status"> &
  Partial<Pick<Question, "id" | "status" | "source">>;

export interface QuestionStore {
  readonly kind: "file" | "supabase";
  init(): Promise<void>;
  list(filter: QuestionFilter): Promise<QuestionPage>;
  get(id: string): Promise<Question | null>;
  create(input: QuestionInput): Promise<Question>;
  update(id: string, patch: Partial<QuestionInput>): Promise<Question>;
  remove(id: string): Promise<void>;
  getPlayablePool(): Promise<Question[]>;
  recordUsage(ids: string[]): Promise<void>;
  recordAnswers(id: string, results: { mode: AnswerMode | null; correct: boolean }[]): Promise<void>;
  summary(): Promise<{ total: number; published: number; draft: number; disabled: number; byCategory: Record<string, number>; byDifficulty: Record<string, number> }>;
}
