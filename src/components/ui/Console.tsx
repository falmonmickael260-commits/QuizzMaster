"use client";

import { useEffect, useRef, useState } from "react";
import { MODE_LABELS, MODE_POINTS, type AnswerMode } from "@shared/config";
import { serverNow, useGame } from "@/lib/net";
import { formatScore } from "@/lib/draw";
import { audio } from "@/lib/audio";

const MODES: AnswerMode[] = ["4", "2", "solo"];

function useFrameNow(active: boolean) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      setNow(serverNow());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

function useRolling(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / 1100);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/**
 * « CAM PUPITRE » : gros plan sur l'écran de votre pupitre (l'écran 3D du décor affiche la même chose).
 * Sur smartphone, c'est l'interface personnelle du candidat.
 */
export function Console() {
  const state = useGame((s) => s.state)!;
  const priv = useGame((s) => s.priv);
  const playerId = useGame((s) => s.playerId);
  const chooseMode = useGame((s) => s.chooseMode);
  const answer = useGame((s) => s.answer);
  const me = state.players.find((p) => p.id === playerId)!;
  const inQuestion = state.phase === "question" && !!state.question;
  const now = useFrameNow(inQuestion);
  const score = useRolling(me.score);
  const [solo, setSolo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = state.question;
  const started = !!q?.text && inQuestion;
  const deadline = priv?.deadline ?? q?.endsAt ?? 0;
  const total = q ? deadline - q.startsAt : 12000;
  const remaining = q ? Math.max(0, deadline - Math.max(now, q.startsAt)) : 0;
  const expired = started && remaining <= 0;
  const canAct = started && !expired && !priv?.answered;

  useEffect(() => setSolo(""), [q?.index]);
  useEffect(() => {
    if (priv?.mode === "solo" && !priv.answered) inputRef.current?.focus();
  }, [priv?.mode, priv?.answered]);

  // raccourcis clavier : 1/2/3 pour l'aide, A-D pour les propositions
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (!priv?.mode) {
        const m = ({ "1": "4", "2": "2", "3": "solo" } as Record<string, AnswerMode>)[e.key];
        if (m) chooseMode(m);
      } else if (priv.options.length) {
        const i = "abcd".indexOf(e.key.toLowerCase());
        if (i >= 0 && priv.options[i]) answer(priv.options[i]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAct, priv, chooseMode, answer]);

  const badges = [];
  if (me.modifiers.shield) badges.push(<span key="s" className="badge good">🛡 BOUCLIER</span>);
  if (me.modifiers.pointsMultiplier === 2) badges.push(<span key="x2" className="badge good">POINTS x2</span>);
  if (me.modifiers.pointsMultiplier === 0.5) badges.push(<span key="h" className="badge bad">DEMI-POINTS</span>);
  if (me.modifiers.timeDeltaSec > 0) badges.push(<span key="t" className="badge good">+{me.modifiers.timeDeltaSec} S</span>);
  if (me.modifiers.timeDeltaSec < 0) badges.push(<span key="t" className="badge bad">{me.modifiers.timeDeltaSec} S</span>);
  if (me.modifiers.pending.pointsMultiplier !== 1 || me.modifiers.pending.timeDeltaSec !== 0) badges.push(<span key="p" className="badge">EFFET À LA PROCHAINE MANCHE</span>);

  let body: React.ReactNode;
  if (state.phase === "question" && q) {
    if (!q.text) {
      body = (
        <div>
          <div className="status-big display">Question {q.inRound + 1} · préparez-vous…</div>
          <div className="status-sub">Écoutez l&apos;animateur — le chrono démarre avec l&apos;affichage de la question.</div>
        </div>
      );
    } else {
      const secs = Math.ceil(remaining / 1000);
      const urgent = secs <= 3 && !priv?.answered;
      const timer = (
        <div className={`timer-bar ${urgent ? "urgent" : ""}`} role="progressbar" aria-valuenow={secs} aria-valuemax={Math.round(total / 1000)}>
          <i style={{ width: `${(remaining / total) * 100}%` }} />
        </div>
      );
      if (priv?.answered) {
        body = (
          <div>
            {timer}
            <div className="status-big display result-good">✓ Réponse verrouillée</div>
            <div className="status-sub">
              {priv.mode === "solo" ? "SOLO" : `${priv.mode} réponses`} · « {priv.answer} » — verdict à la fin du chrono
            </div>
          </div>
        );
      } else if (expired) {
        body = (
          <div>
            {timer}
            <div className="status-big display result-bad">⏱ Temps écoulé !</div>
          </div>
        );
      } else if (!priv?.mode) {
        body = (
          <div>
            {timer}
            <div className="timer-row">
              <div className={`timer-num display ${urgent ? "urgent" : ""}`}>{secs}</div>
              <div className="mode-buttons">
                {MODES.map((m, i) => (
                  <button
                    key={m}
                    className="mode-btn"
                    style={{ background: MODE_LABELS[m].color }}
                    onClick={() => {
                      audio.unlock();
                      chooseMode(m);
                    }}
                  >
                    <b>{MODE_LABELS[m].title}</b>
                    <span>{MODE_POINTS[m]} PTS</span>
                    <small>{MODE_LABELS[m].subtitle}</small>
                    <span className="kbd">touche {i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      } else if (priv.mode === "solo") {
        body = (
          <div>
            {timer}
            <div className="timer-row">
              <div className={`timer-num display ${urgent ? "urgent" : ""}`}>{secs}</div>
              <form
                className="solo-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (solo.trim()) answer(solo.trim());
                }}
              >
                <input ref={inputRef} className="input" placeholder="✍️ Écrivez la réponse…" value={solo} onChange={(e) => setSolo(e.target.value)} maxLength={60} autoComplete="off" autoCapitalize="characters" enterKeyHint="send" />
                <button className="btn primary" type="submit" disabled={!solo.trim()}>
                  Valider · 200
                </button>
              </form>
            </div>
          </div>
        );
      } else {
        body = (
          <div>
            {timer}
            <div className="timer-row">
              <div className={`timer-num display ${urgent ? "urgent" : ""}`}>{secs}</div>
              <div className="options" style={{ gridTemplateColumns: priv.options.length === 2 ? "1fr 1fr" : undefined }}>
                {priv.options.map((o, i) => (
                  <button key={o} className="option-btn" onClick={() => answer(o)}>
                    <span className="option-letter">{"ABCD"[i]}</span>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      }
    }
  } else if (state.phase === "reveal" && state.reveal) {
    const r = state.reveal.results[me.id];
    body = r?.correct ? (
      <div className="points-pop">
        <div className="status-big display result-good">+{r.points} points !</div>
        <div className="status-sub">
          Bonne réponse en {r.mode === "solo" ? "SOLO" : `mode ${r.mode}`}
          {r.multiplier !== 1 ? ` (x${r.multiplier})` : ""}
        </div>
      </div>
    ) : (
      <div>
        <div className="status-big display result-bad">{r?.timedOut ? "Temps écoulé" : "Raté !"}</div>
        <div className="status-sub">
          La réponse était « {state.reveal.correctAnswer} »{r?.answer ? ` — vous aviez dit « ${r.answer} »` : ""}
        </div>
      </div>
    );
  } else {
    body = null;
  }

  return (
    <div className="console" aria-label="Écran de votre pupitre">
      <div className="console-head">
        <span className="cam-tag">CAM PUPITRE · {me.name.toUpperCase()}</span>
        <span className="badges">{badges}</span>
      </div>
      <div className="console-screen">
        {body ?? (
          <div className="me-line">
            <span className="me-name display">{me.name}</span>
            <span className="me-score display">{formatScore(score)} PTS</span>
          </div>
        )}
        {body && (
          <div className="me-line" style={{ marginTop: 8, opacity: 0.85 }}>
            <small className="muted" style={{ fontWeight: 800 }}>
              {me.name.toUpperCase()}
            </small>
            <small className="display" style={{ color: "var(--cyan)", fontSize: 18 }}>
              {formatScore(score)} PTS
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
