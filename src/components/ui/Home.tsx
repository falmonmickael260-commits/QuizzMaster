"use client";

import { useEffect, useState } from "react";
import { CHARACTERS, getCharacter } from "@shared/characters";
import { DEFAULT_ROUNDS, MAX_ROUNDS, MODE_LABELS, MODE_POINTS, QUESTIONS_PER_ROUND } from "@shared/config";
import { useGame } from "@/lib/net";
import { audio } from "@/lib/audio";
import { CharacterPreview } from "./CharacterPreview";

const PROFILE_KEY = "bq-profile";

export function Home() {
  const create = useGame((s) => s.create);
  const join = useGame((s) => s.join);
  const status = useGame((s) => s.status);
  const [name, setName] = useState("");
  const [character, setCharacter] = useState(CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      if (p?.name) setName(p.name);
      if (p?.character) setCharacter(p.character);
    } catch {
      /* ignore */
    }
    const room = new URLSearchParams(location.search).get("room");
    if (room) setCode(room.replace(/[^0-9]/g, "").slice(0, 4));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 4000);
    return () => clearTimeout(t);
  }, [busy]);

  const saveProfile = () => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, character }));
    } catch {
      /* ignore */
    }
  };

  const valid = name.trim().length >= 2;
  const onCreate = () => {
    if (!valid) return;
    audio.unlock();
    audio.select();
    saveProfile();
    setBusy(true);
    create(name.trim(), character, rounds);
  };
  const onJoin = () => {
    if (!valid || code.length !== 4) return;
    audio.unlock();
    audio.select();
    saveProfile();
    setBusy(true);
    join(code, name.trim(), character);
  };
  const preset = getCharacter(character);

  return (
    <div className="home">
      <div className="home-card glass">
        <div className="stack" style={{ alignContent: "start" }}>
          <div>
            <h1 className="home-logo display">
              <span className="logo-blind">BLIND</span>
              <span className="logo-quizz">QUIZZ</span>
            </h1>
            <p className="tagline">
              Le jeu télévisé où <b style={{ color: "#fff" }}>vous choisissez votre aide</b>. 12 secondes par question, jusqu&apos;à 8 candidats sur le plateau, une roue qui
              peut tout renverser.
            </p>
            <div className="modes-legend">
              {(["4", "2", "solo"] as const).map((m) => (
                <div key={m} className="mode-chip" style={{ borderColor: MODE_LABELS[m].color, background: MODE_LABELS[m].color + "18" }}>
                  <b style={{ color: MODE_LABELS[m].color }}>{m === "solo" ? "SOLO" : `${m} RÉP.`}</b>
                  <small>
                    {MODE_POINTS[m]} pts · {MODE_LABELS[m].subtitle}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="preview-wrap">
            <CharacterPreview preset={preset} />
            <div className="preview-name display">{preset.name}</div>
          </div>
        </div>

        <div className="stack">
          <div>
            <label className="label" htmlFor="pseudo">
              Votre pseudo
            </label>
            <input
              id="pseudo"
              className="input"
              placeholder="Ex. ALEX"
              maxLength={14}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (code.length === 4 ? onJoin() : onCreate())}
              autoComplete="nickname"
            />
          </div>
          <div>
            <span className="label">Votre personnage</span>
            <div className="char-grid" role="radiogroup" aria-label="Personnage">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={c.id === character}
                  aria-label={c.name}
                  title={c.name}
                  className={`char-btn ${c.id === character ? "active" : ""}`}
                  onClick={() => {
                    audio.unlock();
                    audio.select();
                    setCharacter(c.id);
                  }}
                >
                  <span className="char-outfit" style={{ background: c.outfit }} />
                  <span className="char-face" style={{ background: c.skin }} />
                  <span className="char-hair" style={{ background: c.hair }} />
                  <span className="char-eyes">
                    <i />
                    <i />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Nombre de manches (5 questions chacune)</span>
            <div className="rounds">
              {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((r) => (
                <button key={r} type="button" className={r === rounds ? "active" : ""} onClick={() => setRounds(r)} title={`${r * QUESTIONS_PER_ROUND} questions`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary" disabled={!valid || busy || status === "connecting"} onClick={onCreate} style={{ fontSize: 18 }}>
            🎬 Créer une émission
          </button>
          <div className="divider">OU REJOINDRE</div>
          <div className="row">
            <div className="input" style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", width: 150, flex: "none" }}>
              <span className="muted" style={{ fontWeight: 900 }}>
                BQ-
              </span>
              <input
                aria-label="Code de la partie"
                inputMode="numeric"
                placeholder="4821"
                value={code}
                maxLength={4}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                onKeyDown={(e) => e.key === "Enter" && onJoin()}
                style={{ background: "transparent", border: 0, outline: "none", width: "100%", fontWeight: 900, fontSize: 20, padding: "12px 0", letterSpacing: "0.1em" }}
              />
            </div>
            <button className="btn cyan" style={{ flex: 1 }} disabled={!valid || code.length !== 4 || busy} onClick={onJoin}>
              Rejoindre le plateau
            </button>
          </div>
          {!valid && name.length > 0 && <small className="muted">Le pseudo doit contenir au moins 2 caractères.</small>}
        </div>
      </div>
    </div>
  );
}
