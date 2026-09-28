"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID, DIFFICULTY_LABELS } from "@shared/categories";
import type { Question, QuestionStatus } from "@shared/types";

const KEY = "bq-admin-key";

interface Info {
  store: "file" | "supabase";
  generation: boolean;
  summary: { total: number; published: number; draft: number; disabled: number; byCategory: Record<string, number>; byDifficulty: Record<string, number> };
}

type Draft = {
  id?: string;
  question: string;
  category: string;
  difficulty: number;
  correctAnswer: string;
  wrongAnswers: [string, string, string];
  acceptedAnswers: string;
  explanation: string;
  status: QuestionStatus;
};

const EMPTY: Draft = { question: "", category: "geographie", difficulty: 2, correctAnswer: "", wrongAnswers: ["", "", ""], acceptedAnswers: "", explanation: "", status: "draft" };

function toDraft(q: Question): Draft {
  return {
    id: q.id,
    question: q.question,
    category: q.category,
    difficulty: q.difficulty,
    correctAnswer: q.correctAnswer,
    wrongAnswers: [q.wrongAnswers[0] ?? "", q.wrongAnswers[1] ?? "", q.wrongAnswers[2] ?? ""],
    acceptedAnswers: q.acceptedAnswers.join(", "),
    explanation: q.explanation,
    status: q.status,
  };
}

function fromDraft(d: Draft) {
  return {
    question: d.question,
    category: d.category,
    difficulty: d.difficulty,
    correctAnswer: d.correctAnswer,
    wrongAnswers: d.wrongAnswers,
    acceptedAnswers: d.acceptedAnswers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    explanation: d.explanation,
    status: d.status,
  };
}

const rate = (q: Question) => (q.stats.answers ? q.stats.correct / q.stats.answers : null);

export default function AdminApp() {
  const [key, setKey] = useState<string | null>(null);
  const [pwd, setPwd] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [items, setItems] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: "", category: "", difficulty: "", status: "", sort: "updated" });
  const [offset, setOffset] = useState(0);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [panel, setPanel] = useState<"none" | "import" | "generate">("none");
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [busy, setBusy] = useState(false);
  const limit = 25;

  useEffect(() => {
    try {
      setKey(sessionStorage.getItem(KEY));
    } catch {
      /* ignore */
    }
  }, []);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`/api/admin${path}`, { ...init, headers: { "content-type": "application/json", "x-admin-key": key ?? "", ...(init?.headers ?? {}) } });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setKey(null);
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
      }
      if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
      return body;
    },
    [key],
  );

  const load = useCallback(async () => {
    if (!key) return;
    const q = new URLSearchParams({ ...filters, offset: String(offset), limit: String(limit) });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    try {
      const [i, page] = await Promise.all([api("/info"), api(`/questions?${q}`)]);
      setInfo(i);
      setItems(page.items);
      setTotal(page.total);
    } catch (e) {
      setMsg({ text: (e as Error).message, tone: "err" });
    }
  }, [api, filters, offset, key]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (text: string, tone: "ok" | "err" = "ok") => {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 4000);
  };

  if (!key) {
    return (
      <div className="admin">
        <form
          className="glass stack"
          style={{ maxWidth: 420, margin: "12vh auto", padding: 24 }}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sessionStorage.setItem(KEY, pwd);
            } catch {
              /* ignore */
            }
            setKey(pwd);
          }}
        >
          <h1 className="display" style={{ margin: 0 }}>
            <span className="logo-blind">BLIND</span>
            <span className="logo-quizz">QUIZZ</span> <span style={{ fontSize: 20, color: "var(--dim)" }}>RÉGIE</span>
          </h1>
          <label className="label" htmlFor="pwd">
            Mot de passe admin
          </label>
          <input id="pwd" type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
          <button className="btn primary">Entrer en régie</button>
          <small className="muted">Défini par la variable d&apos;environnement ADMIN_PASSWORD (« admin » par défaut en développement).</small>
        </form>
      </div>
    );
  }

  const save = async (d: Draft) => {
    setBusy(true);
    try {
      if (d.id) await api(`/questions/${encodeURIComponent(d.id)}`, { method: "PATCH", body: JSON.stringify(fromDraft(d)) });
      else await api("/questions", { method: "POST", body: JSON.stringify(fromDraft(d)) });
      flash(d.id ? "Question mise à jour" : "Question ajoutée");
      setEdit(null);
      await load();
    } catch (e) {
      flash((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (q: Question, status: QuestionStatus) => {
    try {
      await api(`/questions/${encodeURIComponent(q.id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      flash(status === "published" ? "Question publiée" : status === "disabled" ? "Question désactivée" : "Repassée en brouillon");
      await load();
    } catch (e) {
      flash((e as Error).message, "err");
    }
  };

  const remove = async (q: Question) => {
    if (!confirm(`Supprimer définitivement « ${q.question} » ?`)) return;
    try {
      await api(`/questions/${encodeURIComponent(q.id)}`, { method: "DELETE" });
      flash("Question supprimée");
      await load();
    } catch (e) {
      flash((e as Error).message, "err");
    }
  };

  const s = info?.summary;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="admin">
      <div className="admin-wrap">
        <div className="admin-head">
          <h1 className="display">
            <span className="logo-blind">BLIND</span>
            <span className="logo-quizz">QUIZZ</span> <span style={{ fontSize: 22, color: "var(--dim)" }}>· RÉGIE DES QUESTIONS</span>
          </h1>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <a className="btn ghost small" href="/">
              ← Plateau
            </a>
            <button className="btn cyan small" onClick={() => setEdit({ ...EMPTY })}>
              + Nouvelle question
            </button>
            <button className="btn small" onClick={() => setPanel(panel === "import" ? "none" : "import")}>
              ⇪ Importer
            </button>
            <button className="btn primary small" onClick={() => setPanel(panel === "generate" ? "none" : "generate")}>
              ✨ Générer
            </button>
          </div>
        </div>

        {msg && (
          <div className="glass" style={{ padding: 12, fontWeight: 800, borderColor: msg.tone === "err" ? "var(--red)" : "var(--green)" }}>
            {msg.text}
          </div>
        )}

        {s && (
          <div className="stats-row">
            <div className="stat glass">
              <b>{s.total}</b>
              <span>questions au total</span>
            </div>
            <div className="stat glass">
              <b style={{ color: "var(--green)" }}>{s.published}</b>
              <span>publiées (jouables)</span>
            </div>
            <div className="stat glass" style={{ cursor: "pointer" }} onClick={() => setFilters({ ...filters, status: "draft" })}>
              <b style={{ color: "var(--amber)" }}>{s.draft}</b>
              <span>brouillons à relire</span>
            </div>
            <div className="stat glass">
              <b style={{ color: "var(--dim)" }}>{s.disabled}</b>
              <span>désactivées</span>
            </div>
            <div className="stat glass">
              <b>{Object.keys(s.byCategory).length}</b>
              <span>catégories</span>
            </div>
            <div className="stat glass">
              <b style={{ fontSize: 18, lineHeight: "36px" }}>{[1, 2, 3, 4].map((d) => s.byDifficulty[d] ?? 0).join(" · ")}</b>
              <span>facile · moyen · difficile · très diff.</span>
            </div>
            <div className="stat glass">
              <b style={{ fontSize: 20, lineHeight: "36px" }}>{info.store === "supabase" ? "Supabase" : "Fichier local"}</b>
              <span>stockage</span>
            </div>
          </div>
        )}

        {panel === "import" && <ImportPanel api={api} onDone={(t) => (flash(t), setPanel("none"), load())} onError={(t) => flash(t, "err")} />}
        {panel === "generate" && (
          <GeneratePanel
            available={!!info?.generation}
            api={api}
            onDone={(n) => {
              flash(`${n} question(s) générée(s) en brouillon — relisez-les avant publication`);
              setFilters({ ...filters, status: "draft", sort: "updated" });
              setPanel("none");
              void load();
            }}
            onError={(t) => flash(t, "err")}
          />
        )}

        <div className="toolbar glass">
          <input className="input" placeholder="🔎 Rechercher (question, réponse, explication…)" value={filters.search} onChange={(e) => (setOffset(0), setFilters({ ...filters, search: e.target.value }))} />
          <select className="input" value={filters.category} onChange={(e) => (setOffset(0), setFilters({ ...filters, category: e.target.value }))}>
            <option value="">Toutes catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.label} ({s?.byCategory[c.id] ?? 0})
              </option>
            ))}
          </select>
          <select className="input" value={filters.difficulty} onChange={(e) => (setOffset(0), setFilters({ ...filters, difficulty: e.target.value }))}>
            <option value="">Toutes difficultés</option>
            {[1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d].label}
              </option>
            ))}
          </select>
          <select className="input" value={filters.status} onChange={(e) => (setOffset(0), setFilters({ ...filters, status: e.target.value }))}>
            <option value="">Tous statuts</option>
            <option value="published">Publiées</option>
            <option value="draft">Brouillons</option>
            <option value="disabled">Désactivées</option>
          </select>
          <select className="input" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
            <option value="updated">Récemment modifiées</option>
            <option value="category">Par catégorie</option>
            <option value="difficulty">Par difficulté</option>
            <option value="successRate">Taux de réussite (croissant)</option>
            <option value="used">Les plus jouées</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="q-table">
            <thead>
              <tr>
                <th>Question</th>
                <th className="hide-sm">Catégorie</th>
                <th>Niveau</th>
                <th className="hide-sm">Stats</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((q) => {
                const r = rate(q);
                return (
                  <tr key={q.id}>
                    <td style={{ minWidth: 280 }}>
                      <div className="q-text">{q.question}</div>
                      <div className="q-sub">
                        <span className="q-answer">✓ {q.correctAnswer}</span> · ✗ {q.wrongAnswers.join(" · ")}
                      </div>
                    </td>
                    <td className="hide-sm">{CATEGORY_BY_ID[q.category] ? `${CATEGORY_BY_ID[q.category].emoji} ${CATEGORY_BY_ID[q.category].label}` : q.category}</td>
                    <td>
                      <span style={{ color: DIFFICULTY_LABELS[q.difficulty].color, fontWeight: 800 }}>{DIFFICULTY_LABELS[q.difficulty].label}</span>
                    </td>
                    <td className="hide-sm" style={{ whiteSpace: "nowrap" }}>
                      <div>
                        {q.stats.timesUsed} partie{q.stats.timesUsed > 1 ? "s" : ""} · {q.stats.answers} rép.
                      </div>
                      <div className="q-sub" style={{ marginTop: 2 }}>
                        2 : {q.stats.byMode["2"].answers} · 4 : {q.stats.byMode["4"].answers} · SOLO : {q.stats.byMode.solo.answers}
                        {q.stats.answers + q.stats.timeouts > 0 && <> · erreurs {Math.round(((q.stats.answers - q.stats.correct + q.stats.timeouts) / (q.stats.answers + q.stats.timeouts)) * 100)} %</>}
                      </div>
                      {r !== null ? (
                        <>
                          <div style={{ fontWeight: 800, color: r > 0.85 ? "var(--amber)" : r < 0.2 ? "var(--red)" : "var(--green)" }}>
                            {Math.round(r * 100)} % de réussite {q.stats.answers < 10 ? "" : r > 0.85 ? "(trop facile ?)" : r < 0.2 ? "(trop dure ?)" : ""}
                          </div>
                          <div className="rate-bar">
                            <i style={{ width: `${r * 100}%`, background: r > 0.85 ? "var(--amber)" : r < 0.2 ? "var(--red)" : "var(--green)" }} />
                          </div>
                        </>
                      ) : (
                        <div className="muted">pas encore jouée</div>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill status-${q.status}`}>{q.status === "published" ? "PUBLIÉE" : q.status === "draft" ? "BROUILLON" : "DÉSACTIVÉE"}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn small" onClick={() => setEdit(toDraft(q))}>
                          Modifier
                        </button>
                        {q.status !== "published" && (
                          <button className="btn cyan small" onClick={() => setStatus(q, "published")}>
                            Publier
                          </button>
                        )}
                        {q.status === "published" && (
                          <button className="btn ghost small" onClick={() => setStatus(q, "disabled")}>
                            Désactiver
                          </button>
                        )}
                        <button className="btn ghost small" onClick={() => remove(q)} title="Supprimer">
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <p className="muted">Aucune question ne correspond à ces filtres.</p>}
        </div>

        <div className="pager">
          <span className="muted">
            {total} résultat{total > 1 ? "s" : ""} · page {Math.floor(offset / limit) + 1}/{pages}
          </span>
          <div className="row">
            <button className="btn small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
              ← Précédent
            </button>
            <button className="btn small" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
              Suivant →
            </button>
          </div>
        </div>
      </div>

      {edit && <Editor draft={edit} busy={busy} onCancel={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function Editor({ draft, busy, onCancel, onSave }: { draft: Draft; busy: boolean; onCancel: () => void; onSave: (d: Draft) => void }) {
  const [d, setD] = useState(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  return (
    <div className="modal-back" onClick={onCancel}>
      <form
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
      >
        <h2 className="display" style={{ margin: 0 }}>
          {d.id ? "Modifier la question" : "Nouvelle question"}
        </h2>
        <div>
          <label className="label">Question</label>
          <textarea className="input" value={d.question} onChange={(e) => set("question", e.target.value)} required maxLength={300} />
        </div>
        <div className="grid3">
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={d.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Difficulté</label>
            <select className="input" value={d.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {DIFFICULTY_LABELS[n].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={d.status} onChange={(e) => set("status", e.target.value as QuestionStatus)}>
              <option value="draft">Brouillon</option>
              <option value="published">Publiée</option>
              <option value="disabled">Désactivée</option>
            </select>
          </div>
        </div>
        <div className="grid2">
          <div>
            <label className="label">Bonne réponse</label>
            <input className="input" value={d.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} required maxLength={80} />
          </div>
          <div>
            <label className="label">Variantes acceptées en SOLO (séparées par des virgules)</label>
            <input className="input" value={d.acceptedAnswers} onChange={(e) => set("acceptedAnswers", e.target.value)} placeholder="Ex. Roma, rome antique" />
          </div>
        </div>
        <div>
          <label className="label">Mauvaises réponses crédibles (la 1re sert au mode 2 réponses)</label>
          <div className="grid3">
            {d.wrongAnswers.map((w, i) => (
              <input
                key={i}
                className="input"
                value={w}
                required
                maxLength={80}
                placeholder={i === 0 ? "La plus tentante" : `Mauvaise réponse ${i + 1}`}
                onChange={(e) => {
                  const next = [...d.wrongAnswers] as Draft["wrongAnswers"];
                  next[i] = e.target.value;
                  set("wrongAnswers", next);
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="label">Explication (affichée après la réponse)</label>
          <textarea className="input" value={d.explanation} onChange={(e) => set("explanation", e.target.value)} required maxLength={400} />
        </div>
        <div className="preview-box">
          <b>Aperçu des trois niveaux d&apos;aide</b>
          <div>
            <span className="muted">4 RÉPONSES · 100 pts</span>
            <div className="preview-opts">
              <span className="ok">{d.correctAnswer || "?"}</span>
              {d.wrongAnswers.map((w, i) => (
                <span key={i}>{w || "?"}</span>
              ))}
            </div>
          </div>
          <div>
            <span className="muted">2 RÉPONSES · 50 pts</span>
            <div className="preview-opts">
              <span className="ok">{d.correctAnswer || "?"}</span>
              <span>{d.wrongAnswers[0] || "?"}</span>
            </div>
          </div>
          <div>
            <span className="muted">SOLO · 200 pts — accepté :</span> {[d.correctAnswer, ...d.acceptedAnswers.split(",")].map((x) => x.trim()).filter(Boolean).join(" / ") || "?"}
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn primary" disabled={busy}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

type Api = (path: string, init?: RequestInit) => Promise<{ imported?: number; errors?: { index: number; error: string }[]; created?: unknown[]; rejected?: unknown[] }>;

function ImportPanel({ api, onDone, onError }: { api: Api; onDone: (t: string) => void; onError: (t: string) => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  return (
    <div className="glass stack" style={{ padding: 16 }}>
      <b>Importer des questions (JSON)</b>
      <small className="muted">
        Format : un tableau d&apos;objets {"{ question, category, difficulty (1-4), correctAnswer, wrongAnswers: [3], acceptedAnswers: [], explanation }"}. Les catégories valides sont : {CATEGORIES.map((c) => c.id).join(", ")}.
      </small>
      <input
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setText(await f.text());
        }}
      />
      <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"question": "…", "category": "histoire", …}]' />
      <div className="row">
        <select className="input" style={{ width: 240 }} value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
          <option value="draft">Importer en brouillon (à relire)</option>
          <option value="published">Publier directement</option>
        </select>
        <button
          className="btn cyan"
          onClick={async () => {
            try {
              const parsed = JSON.parse(text);
              const res = await api("/import", { method: "POST", body: JSON.stringify({ questions: Array.isArray(parsed) ? parsed : parsed.questions, status }) });
              const errs = res.errors ?? [];
              onDone(`${res.imported} question(s) importée(s)${errs.length ? `, ${errs.length} rejetée(s) : ${errs.slice(0, 3).map((x) => `#${x.index} ${x.error}`).join(" ; ")}` : ""}`);
            } catch (e) {
              onError((e as Error).message);
            }
          }}
        >
          Importer
        </button>
      </div>
    </div>
  );
}

function GeneratePanel({ available, api, onDone, onError }: { available: boolean; api: Api; onDone: (n: number) => void; onError: (t: string) => void }) {
  const [category, setCategory] = useState("geographie");
  const [difficulty, setDifficulty] = useState(2);
  const [count, setCount] = useState(10);
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="glass stack" style={{ padding: 16 }}>
      <b>Générer des questions avec l&apos;IA</b>
      {!available && (
        <small style={{ color: "var(--amber)", fontWeight: 700 }}>
          Génération indisponible : définissez ANTHROPIC_API_KEY sur le serveur. Les questions générées arrivent en brouillon et doivent être relues avant publication.
        </small>
      )}
      <div className="grid3">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
        <select className="input" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              Niveau {DIFFICULTY_LABELS[n].label.toLowerCase()}
            </option>
          ))}
        </select>
        <input className="input" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
      </div>
      <input className="input" placeholder="Consigne facultative (ex. « capitales d'Afrique », « anecdotes surprenantes »)" value={theme} onChange={(e) => setTheme(e.target.value)} />
      <button
        className="btn primary"
        disabled={!available || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await api("/generate", { method: "POST", body: JSON.stringify({ category, difficulty, count, theme }) });
            onDone(res.created?.length ?? 0);
          } catch (e) {
            onError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Génération en cours…" : `✨ Générer ${count} questions ${CATEGORY_BY_ID[category]?.label.toLowerCase()} niveau ${DIFFICULTY_LABELS[difficulty].label.toLowerCase()}`}
      </button>
    </div>
  );
}
