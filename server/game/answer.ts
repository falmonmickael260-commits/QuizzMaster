// Correction intelligente des réponses libres (mode SOLO).
// Tolère majuscules, accents, espaces, ponctuation, articles et petites fautes de frappe.

const LEADING_ARTICLES = /^(le|la|les|l|un|une|des|du|de|d|the|an|el|los|las|il|lo|leur|leurs|son|sa|ses|au|aux|en)\s+/;

export function normalizeAnswer(input: string): string {
  let s = (input ?? "").toString().toLowerCase().trim();
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss");
  s = s.replace(/&/g, " et ");
  // le signe moins devant un nombre compte (-4 °C ≠ 4 °C)
  s = s.replace(/(^|\s)[-−](?=\d)/g, "$1moins ");
  // apostrophes et tirets deviennent des espaces
  s = s.replace(/['’`´\-‐–—_/.]/g, " ");
  s = s.replace(/[^a-z0-9 ]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // articles en tête (« la Tour Eiffel » = « Tour Eiffel »)
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(LEADING_ARTICLES, "");
  }
  return s;
}

/** Version sans espaces pour comparer « new york » et « newyork ». */
function compact(s: string): string {
  return s.replace(/ /g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Nombre de fautes de frappe tolérées pour un mot selon sa longueur. */
function wordTolerance(word: string): number {
  if (/\d/.test(word)) return 0; // jamais de tolérance sur un nombre (1 440 ≠ 1 441)
  if (/^[ivxlcdm]+$/.test(word)) return 0; // chiffres romains : Louis XIV ≠ Louis XVI
  const len = word.length;
  if (len <= 4) return 0;
  if (len <= 8) return 1;
  return 2;
}

/** Compare mot à mot en tolérant quelques fautes de frappe dans les mots longs uniquement. */
function fuzzyEqual(given: string, expected: string): boolean {
  const g = given.split(" ");
  const e = expected.split(" ");
  if (g.length !== e.length) return false;
  return e.every((w, i) => {
    const tol = wordTolerance(w);
    return tol === 0 ? w === g[i] : Math.abs(w.length - g[i].length) <= tol && levenshtein(w, g[i]) <= tol;
  });
}

export function isAnswerCorrect(given: string, correct: string, accepted: string[] = []): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const candidates = [correct, ...accepted].map(normalizeAnswer).filter(Boolean);
  for (const c of candidates) {
    if (g === c) return true;
    if (compact(g) === compact(c)) return true;
    if (fuzzyEqual(g, c)) return true;
  }
  return false;
}
