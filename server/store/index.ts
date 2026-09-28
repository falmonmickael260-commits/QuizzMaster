import { FileQuestionStore } from "./fileStore";
import { SupabaseQuestionStore } from "./supabaseStore";
import type { QuestionStore } from "./types";

/** Supabase si SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sont définis, sinon stockage fichier local. */
export async function createQuestionStore(): Promise<QuestionStore> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const store = new SupabaseQuestionStore(url, key);
    await store.init();
    return store;
  }
  const store = new FileQuestionStore();
  await store.init();
  return store;
}
