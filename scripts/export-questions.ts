// Exporte la base initiale au format JSON importable depuis la régie (/admin → Importer).
//   npm run questions:export > questions.json

import { SEED_QUESTIONS } from "../data/questions";

const out = SEED_QUESTIONS.map(({ id, question, category, difficulty, correctAnswer, acceptedAnswers, wrongAnswers, explanation }) => ({
  id,
  question,
  category,
  difficulty,
  correctAnswer,
  acceptedAnswers,
  wrongAnswers,
  explanation,
}));
process.stdout.write(JSON.stringify(out, null, 2));
