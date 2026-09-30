"use client";

// Menu principal « QUIZZ MASTER » : profil, logo couronné, modes 2 / 4 / SOLO,
// choix et personnalisation du personnage, pseudo, manches, créer / regarder / rejoindre.

import { useEffect, useRef, useState } from "react";
import {
  ACCESSORIES,
  ACCESSORY_COLORS,
  ACCESSORY_LABELS,
  CHARACTERS,
  HAIR_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_LABELS,
  OUTFIT_COLORS,
  SKIN_TONES,
  encodeLook,
  getCharacter,
  isValidCharacter,
  lookOf,
  type CharacterLook,
} from "@shared/characters";
import { DEFAULT_ROUNDS, MAX_ROUNDS } from "@shared/config";
import { useGame } from "@/lib/net";
import { audio } from "@/lib/audio";
import { drawQuizzMasterLogo } from "@/lib/logo";
import { CharacterPreview } from "./CharacterPreview";
import { Avatar } from "./Avatar";

const PROFILE_KEY = "bq-profile";
type Tab = "outfit" | "accessory" | "hair" | "skin";

function Logo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      if (c) drawQuizzMasterLogo(c.getContext("2d")!, c.width, false);
    };
    draw();
    void document.fonts?.ready.then(draw);
  }, []);
  return (
    <div className="menu-logo-wrap">
      <div className="menu-logo-halo" aria-hidden />
      <canvas ref={ref} className="menu-logo" width={720} height={720} aria-label="QUIZZ MASTER" role="img" />
    </div>
  );
}

function PeopleIcon({ n, color }: { n: 1 | 2 | 4; color: string }) {
  const heads = n === 1 ? [[20, 1]] : n === 2 ? [[13, 0.9], [27, 0.9]] : [[6, 0.7], [15, 0.85], [25, 0.85], [34, 0.7]];
  return (
    <svg width="64" height="40" viewBox="0 0 40 26" aria-hidden>
      {heads.map(([x, k], i) => (
        <g key={i} fill={color}>
          <circle cx={x} cy={9 - k * 2} r={5 * k} />
          <path d={`M${x - 8 * k} 26c0-7 ${3.5 * k}-11 ${8 * k}-11s${8 * k} 4 ${8 * k} 11z`} />
        </g>
      ))}
    </svg>
  );
}

export function Home() {
  const create = useGame((s) => s.create);
  const join = useGame((s) => s.join);
  const startDemo = useGame((s) => s.startDemo);
  const status = useGame((s) => s.status);
  const [name, setName] = useState("");
  const [character, setCharacter] = useState(CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id);
  const [rounds, setRounds] = useState(DEFAULT_ROUNDS);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [settings, setSettings] = useState(false);
  const [muted, setMuted] = useState(audio.muted);
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      if (p?.name) setName(p.name);
      if (isValidCharacter(p?.character)) setCharacter(p.character);
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(location.search);
    // /?partie-test : lance directement une partie de démonstration regardable
    if (params.has("partie-test")) {
      const manches = Math.max(1, Math.min(6, Number(params.get("manches")) || 2));
      const joueurs = Math.max(2, Math.min(8, Number(params.get("joueurs")) || 4));
      startDemo(params.get("pseudo") || "Alex", params.get("perso") || "hugo", manches, joueurs - 1);
      return;
    }
    const room = params.get("room");
    if (room) setCode(room.replace(/[^0-9]/g, "").slice(0, 4));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const ready = !busy && status !== "connecting";
  const needName = () => {
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const onCreate = () => {
    if (!valid) return needName();
    audio.unlock();
    saveProfile();
    setBusy(true);
    create(name.trim(), character, rounds);
  };
  const onJoin = () => {
    if (!valid) return needName();
    if (code.length !== 4) return codeRef.current?.focus();
    audio.unlock();
    saveProfile();
    setBusy(true);
    join(code, name.trim(), character);
  };
  const onDemo = () => {
    audio.unlock();
    saveProfile();
    setBusy(true);
    startDemo(valid ? name.trim() : "Alex", character, rounds);
  };

  const preset = getCharacter(character);
  const look = lookOf(character);
  const baseIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === look.base));
  const pickBase = (i: number) => setCharacter(CHARACTERS[(i + CHARACTERS.length) % CHARACTERS.length].id);
  const edit = (patch: Partial<CharacterLook>) => setCharacter(encodeLook({ ...look, ...patch }));

  const swatches = (list: string[], current: number, onPick: (i: number) => void, label: string) => (
    <div className="menu-swatches" role="radiogroup" aria-label={label}>
      {list.map((c, i) => (
        <button key={c} type="button" role="radio" aria-checked={i === current} className={`menu-swatch ${i === current ? "active" : ""}`} style={{ background: c }} onClick={() => onPick(i)} title={c} />
      ))}
    </div>
  );

  return (
    <div className="menu">
      <div className="menu-bg" />
      <div className="menu-bg-shade" />
      <div className="menu-sparkles" aria-hidden />
      <div className="menu-col">
        {/* profil + réglages */}
        <header className="menu-top">
          <button type="button" className="menu-profile" onClick={needName} title="Modifier le pseudo">
            <Avatar character={character} size={52} ring="#29e7ff" />
            <span>
              <b>{name.trim() || "Joueur"}</b>
              <small>👑 Candidat</small>
            </span>
          </button>
          <div className="menu-settings">
            <button type="button" className="menu-icon" aria-label="Réglages" aria-expanded={settings} onClick={() => setSettings(!settings)}>
              ⚙
            </button>
            {settings && (
              <div className="menu-pop">
                <button
                  type="button"
                  onClick={() => {
                    audio.unlock();
                    audio.setMuted(!muted);
                    setMuted(!muted);
                  }}
                >
                  {muted ? "🔇 Son coupé" : "🔊 Son activé"}
                </button>
              </div>
            )}
          </div>
        </header>

        <Logo />

        <div className="menu-card menu-tagline">
          <b>Le jeu télévisé où vous choisissez votre aide !</b>
          <span>12 secondes par question, jusqu&apos;à 8 candidats sur le plateau, une roue qui peut tout renverser.</span>
        </div>

        <div className="menu-modes">
          <div className="menu-mode gold">
            <span className="menu-shield" aria-hidden>
              ♛
            </span>
            <i className="menu-chev" aria-hidden>
              ›
            </i>
            <PeopleIcon n={2} color="#ffc94a" />
            <b>2 RÉPONSES</b>
            <em>50 pts</em>
            <small>Plus de sécurité</small>
          </div>
          <div className="menu-mode blue">
            <i className="menu-chev" aria-hidden>
              ›
            </i>
            <PeopleIcon n={4} color="#3a86ff" />
            <b>4 RÉPONSES</b>
            <em>100 pts</em>
            <small>Plus de possibilités</small>
          </div>
          <div className="menu-mode green">
            <i className="menu-chev" aria-hidden>
              ›
            </i>
            <PeopleIcon n={1} color="#2ee59d" />
            <b>SOLO</b>
            <em>200 pts</em>
            <small>Aucun filet de sécurité</small>
          </div>
        </div>

        {/* personnage */}
        <section className="menu-card menu-perso">
          <div className="menu-perso-left">
            <h2>Votre personnage</h2>
            <div className="menu-grid" role="radiogroup" aria-label="Personnage">
              {CHARACTERS.map((c, i) => (
                <button key={c.id} type="button" role="radio" aria-checked={i === baseIndex} aria-label={c.name} title={c.name} className={`menu-face ${i === baseIndex ? "active" : ""}`} onClick={() => pickBase(i)}>
                  <Avatar character={c.id} size={46} />
                </button>
              ))}
            </div>
          </div>
          <div className="menu-stage">
            <div className="menu-preview">
              <CharacterPreview preset={preset} distance={6.2} />
            </div>
            <div className="menu-spot" aria-hidden />
            <div className="menu-pedestal" />
            <button type="button" className="menu-arrow left" aria-label="Personnage précédent" onClick={() => pickBase(baseIndex - 1)}>
              ‹
            </button>
            <button type="button" className="menu-arrow right" aria-label="Personnage suivant" onClick={() => pickBase(baseIndex + 1)}>
              ›
            </button>
          </div>
          <div className="menu-perso-right">
            <div className="menu-box">
              <h3>Personnaliser</h3>
              <div className="menu-tabs">
                {(
                  [
                    ["outfit", "👕", "Tenue"],
                    ["accessory", "🎧", "Accessoire"],
                    ["hair", "💇", "Coiffure"],
                    ["skin", "🖌️", "Teint"],
                  ] as const
                ).map(([id, icon, label]) => (
                  <button key={id} type="button" className={tab === id ? "active" : ""} aria-pressed={tab === id} title={label} aria-label={label} onClick={() => setTab(tab === id ? null : id)}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="menu-box">
              <h3>
                <label htmlFor="pseudo">Votre pseudo</label>
              </h3>
              <div className="menu-input">
                <input ref={nameRef} id="pseudo" placeholder="Ex. Mickael" maxLength={14} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onCreate()} autoComplete="nickname" />
                <span aria-hidden>✎</span>
              </div>
              {!valid && name.length > 0 && <small className="menu-warn">2 caractères minimum</small>}
            </div>
            <div className="menu-box">
              <h3>
                Nombre de manches <small>(5 questions chacune)</small>
              </h3>
              <div className="menu-rounds">
                {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((r) => (
                  <button key={r} type="button" className={r === rounds ? "active" : ""} onClick={() => setRounds(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {tab && (
            <div className="menu-custom">
              {tab === "outfit" && (
                <>
                  <h4>Couleur de la tenue</h4>
                  {swatches(OUTFIT_COLORS, look.outfit, (i) => edit({ outfit: i }), "Couleur de la tenue")}
                </>
              )}
              {tab === "accessory" && (
                <>
                  <h4>Accessoire</h4>
                  <div className="menu-chips">
                    {ACCESSORIES.map((a) => (
                      <button key={a} type="button" className={a === look.accessory ? "active" : ""} onClick={() => edit({ accessory: a })}>
                        {ACCESSORY_LABELS[a]}
                      </button>
                    ))}
                  </div>
                  {look.accessory !== "none" && swatches(ACCESSORY_COLORS, look.accessoryColor, (i) => edit({ accessoryColor: i }), "Couleur de l'accessoire")}
                </>
              )}
              {tab === "hair" && (
                <>
                  <h4>Coiffure</h4>
                  <div className="menu-chips">
                    {HAIR_STYLES.map((h) => (
                      <button key={h} type="button" className={h === look.hairStyle ? "active" : ""} onClick={() => edit({ hairStyle: h })}>
                        {HAIR_STYLE_LABELS[h]}
                      </button>
                    ))}
                  </div>
                  {swatches(HAIR_COLORS, look.hair, (i) => edit({ hair: i }), "Couleur des cheveux")}
                </>
              )}
              {tab === "skin" && (
                <>
                  <h4>Teint</h4>
                  {swatches(SKIN_TONES, look.skin, (i) => edit({ skin: i }), "Teint")}
                </>
              )}
            </div>
          )}
        </section>

        <button type="button" className="menu-cta create" disabled={!ready} onClick={onCreate}>
          <span aria-hidden>🎬</span> Créer une émission <i aria-hidden>›</i>
        </button>
        <div className="menu-row">
          <button type="button" className="menu-cta demo" disabled={!ready} onClick={onDemo}>
            <span className="menu-play" aria-hidden>
              ▶
            </span>
            <span>
              Regarder
              <br />
              une partie démonstration
            </span>
          </button>
          <button type="button" className="menu-cta teal" onClick={() => (code.length === 4 ? onJoin() : codeRef.current?.focus())}>
            <span className="menu-play teal" aria-hidden>
              👥
            </span>
            <span>
              Rejoindre
              <br />
              le plateau
            </span>
          </button>
        </div>
        <div className="menu-divider">OU REJOINDRE</div>
        <div className="menu-join">
          <div className="menu-code">
            <span aria-hidden>🔗</span>
            <b>BQ-</b>
            <input ref={codeRef} aria-label="Code de la partie" inputMode="numeric" placeholder="4821" value={code} maxLength={4} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} onKeyDown={(e) => e.key === "Enter" && onJoin()} />
            <button
              type="button"
              aria-label="Coller le code"
              title="Coller le code"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  const digits = t.replace(/[^0-9]/g, "").slice(-4);
                  if (digits.length === 4) setCode(digits);
                } catch {
                  codeRef.current?.focus();
                }
              }}
            >
              ⧉
            </button>
          </div>
          <button type="button" className="menu-cta join" disabled={!ready || code.length !== 4} onClick={onJoin}>
            Rejoindre <i aria-hidden>›</i>
          </button>
        </div>
      </div>
    </div>
  );
}
