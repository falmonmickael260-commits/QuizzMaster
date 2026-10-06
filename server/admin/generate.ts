// Génération de questions par IA (Claude) pour l'espace admin.
// Les questions générées sont enregistrées en BROUILLON : un admin les relit avant publication.

import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_BY_ID, DIFFICULTY_LABELS } from "../../shared/categories";
import type { Question } from "../../shared/types";
import { validateQuestionInput } from "../store/validate";
import type { QuestionInput } from "../store/types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          correctAnswer: { type: "string" },
          acceptedAnswers: { type: "array", items: { type: "string" } },
          wrongAnswers: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
        },
        required: ["question", "correctAnswer", "acceptedAnswers", "wrongAnswers", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const SYSTEM = `Tu es l'auteur des questions de BLIND QUIZZ, un jeu télévisé français de culture générale.
Chaque question se joue en 15 secondes selon trois niveaux d'aide : 2 propositions (50 pts), 4 propositions (100 pts) ou réponse libre SOLO (200 pts).
Exigences de qualité :
- Faits exacts et vérifiables, une seule réponse correcte sans ambiguïté.
- Formulation courte, naturelle, lisible en quelques secondes (max ~110 caractères).
- Bonne réponse courte (1 à 4 mots) pour pouvoir être tapée en mode SOLO.
- Exactement 3 mauvaises réponses crédibles, du même type que la bonne réponse, classées de la plus tentante à la moins tentante (la première sert au mode 2 propositions). Elles appartiennent au même univers que la bonne réponse (villes pour une ville, dates pour une date, joueurs pour un joueur…) et doivent faire hésiter. Jamais de réponse absurde.
- acceptedAnswers : variantes légitimes pour la saisie libre (orthographes alternatives, nom complet/court, chiffres en lettres). Peut être vide.
- Explication : 1 à 2 phrases, intéressante, qui apprend quelque chose au joueur.
- Varie les angles : anecdotes, faits surprenants, pièges, culture populaire. Pas de questions répétitives ni mécaniques.
- Tout en français.`;

export function generationAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function generateQuestions(opts: {
  category: string;
  difficulty: number;
  count: number;
  theme?: string;
  existing: Question[];
}): Promise<{ created: QuestionInput[]; rejected: { item: unknown; reason: string }[] }> {
  const cat = CATEGORY_BY_ID[opts.category];
  if (!cat) throw new Error("Catégorie inconnue");
  const count = Math.max(1, Math.min(50, Math.round(opts.count)));
  const diff = DIFFICULTY_LABELS[opts.difficulty]?.label ?? "Moyen";
  // On transmet les questions existantes de la catégorie pour éviter les doublons.
  const existingList = opts.existing
    .filter((q) => q.category === opts.category)
    .map((q) => `- ${q.question} (${q.correctAnswer})`)
    .join("\n");

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Génère ${count} questions pour la catégorie « ${cat.label} », niveau de difficulté « ${diff} » (${opts.difficulty}/4).${
          opts.theme ? `\nThème ou consigne supplémentaire : ${opts.theme}` : ""
        }\n\nQuestions déjà présentes dans la base (à ne pas reproduire) :\n${existingList || "(aucune)"}`,
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("La génération a été refusée par le modèle.");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: { questions: unknown[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Réponse du modèle illisible (JSON invalide).");
  }

  const created: QuestionInput[] = [];
  const rejected: { item: unknown; reason: string }[] = [];
  const seen = new Set(opts.existing.map((q) => q.question.toLowerCase()));
  for (const item of parsed.questions ?? []) {
    try {
      const v = validateQuestionInput({ ...(item as object), category: opts.category, difficulty: opts.difficulty }) as QuestionInput;
      if (seen.has(v.question.toLowerCase())) throw new Error("doublon");
      seen.add(v.question.toLowerCase());
      created.push({ ...v, status: "draft", source: "ai" });
    } catch (e) {
      rejected.push({ item, reason: (e as Error).message });
    }
  }
  return { created, rejected };
}
