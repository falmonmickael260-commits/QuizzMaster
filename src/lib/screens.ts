// Contenu des écrans intégrés au plateau : grand écran, pupitres, panneau LED, roue, sol.

import { MODE_LABELS, MODE_ORDER, MODE_POINTS, QUESTIONS_PER_ROUND, REVEAL_LOCK_MS, type AnswerMode } from "@shared/config";
import { CATEGORY_BY_ID, DIFFICULTY_LABELS } from "@shared/categories";
import type { PrivateState, PublicPlayer, PublicRoomState } from "@shared/types";
import { WHEEL_SEGMENTS, WHEEL_TONE_COLORS } from "@shared/wheel";
import { C, drawLogo, fitLine, fitText, font, fontsVersion, formatScore, glow, isTweening, noGlow, pill, rr, screenBackground, timerRing, tweenScore, type Ctx } from "./draw";


function catLabel(id: string) {
  const c = CATEGORY_BY_ID[id];
  return c ? `${c.emoji}  ${c.label.toUpperCase()}` : id.toUpperCase();
}

function playerName(s: PublicRoomState, id: string | null | undefined) {
  return s.players.find((p) => p.id === id)?.name ?? "?";
}

// ═════════════════════════════════════════════════════════════════════════════
// GRAND ÉCRAN
// ═════════════════════════════════════════════════════════════════════════════

export function bigScreenSig(s: PublicRoomState | null, now: number): string {
  if (!s) return `none|${Math.floor(now / 100)}|${fontsVersion}`;
  const t = now - s.phaseStartedAt;
  // animations : on redessine ~15 fois par seconde pendant les phases animées
  // Cadence adaptée au contenu : fluide quand ça bouge vraiment, économe sinon.
  let period = 1000;
  if (t < 3500 || (s.phase === "leaderboard" && t < 3000) || (s.phase === "final" && t < 5000)) period = 80;
  else if (s.phase === "question" && s.question?.text) period = 200;
  else if (s.phase === "wheel" || s.phase === "final" || s.phase === "question") period = 250;
  else if (s.phase === "lobby") period = 400;
  const tick = Math.floor(now / period);
  return [s.phase, s.phaseStartedAt, s.question?.text.length, s.reveal?.questionIndex, s.wheel?.stage, s.players.length, s.players.map((p) => `${p.answered ? 1 : 0}${p.score}`).join(","), tick, fontsVersion].join("|");
}

export function drawBigScreen(ctx: Ctx, w: number, h: number, s: PublicRoomState | null, now: number) {
  ctx.clearRect(0, 0, w, h);
  screenBackground(ctx, w, h, s?.phase === "question" ? "#10205a" : s?.phase === "reveal" ? "#0d3a3a" : s?.phase === "wheel" ? "#3a0d3a" : C.bg2, now);
  if (!s) {
    drawLogo(ctx, w / 2, h * 0.45, h * 0.2, now);
    return;
  }
  const t = now - s.phaseStartedAt;
  switch (s.phase) {
    case "lobby":
      return drawLobby(ctx, w, h, s, now);
    case "intro":
      return drawIntro(ctx, w, h, t, now);
    case "round_intro":
      return drawRoundIntro(ctx, w, h, s, t);
    case "question":
      return drawQuestion(ctx, w, h, s, now);
    case "reveal":
      return drawReveal(ctx, w, h, s, t);
    case "leaderboard":
      return drawRanking(ctx, w, h, s, t, now, `CLASSEMENT · MANCHE ${s.round}`);
    case "wheel":
      return drawWheelScreen(ctx, w, h, s, now);
    case "final":
      return drawFinal(ctx, w, h, s, t, now);
  }
}

function header(ctx: Ctx, w: number, h: number, s: PublicRoomState, center?: string) {
  drawLogo(ctx, w * 0.12, h * 0.075, h * 0.065);
  if (center) pill(ctx, center, w / 2, h * 0.075, h * 0.034, "#ffffff14", C.white, "#ffffff40");
  ctx.fillStyle = C.dim;
  font(ctx, h * 0.034, "text", 800);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  if (s.round > 0) ctx.fillText(`MANCHE ${s.round}/${s.totalRounds}  ·  Q ${Math.max(1, s.questionNumber)}/${s.totalQuestions}`, w * 0.96, h * 0.075);
}

function drawLobby(ctx: Ctx, w: number, h: number, s: PublicRoomState, now: number) {
  if (s.code === "DEMO") return drawIntro(ctx, w, h, 4000 + (now % 1000), now);
  drawLogo(ctx, w / 2, h * 0.3, h * 0.2, now);
  ctx.fillStyle = C.dim;
  font(ctx, h * 0.045, "text", 700);
  ctx.textAlign = "center";
  ctx.fillText("CODE DE LA PARTIE", w / 2, h * 0.55);
  glow(ctx, C.cyan, 30);
  ctx.fillStyle = C.white;
  font(ctx, h * 0.15, "display");
  ctx.fillText(s.code, w / 2, h * 0.67);
  noGlow(ctx);
  ctx.fillStyle = C.cyan;
  font(ctx, h * 0.045, "text", 800);
  const dots = ".".repeat(1 + (Math.floor(now / 500) % 3));
  ctx.fillText(`${s.players.length}/8 candidats sur le plateau — en attente${dots}`, w / 2, h * 0.82);
  ctx.fillStyle = C.dim;
  font(ctx, h * 0.032, "text", 600);
  ctx.fillText(`${s.settings.rounds} manche${s.settings.rounds > 1 ? "s" : ""} de 5 questions · 12 secondes par question`, w / 2, h * 0.9);
}

function drawIntro(ctx: Ctx, w: number, h: number, t: number, now: number) {
  const p = Math.min(1, t / 900);
  ctx.save();
  ctx.globalAlpha = p;
  drawLogo(ctx, w / 2, h * 0.34, h * (0.14 + 0.08 * p), now);
  ctx.restore();
  if (t > 1200) {
    ctx.fillStyle = C.white;
    font(ctx, h * 0.05, "text", 800);
    ctx.textAlign = "center";
    ctx.fillText("À CHAQUE QUESTION, CHOISISSEZ VOTRE AIDE", w / 2, h * 0.58);
  }
  MODE_ORDER.forEach((m, i) => {
    const appear = Math.min(1, Math.max(0, (t - 1800 - i * 400) / 400));
    if (appear <= 0) return;
    const cx = w * (0.28 + i * 0.22);
    const cy = h * 0.76;
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(cx, cy);
    ctx.scale(0.8 + 0.2 * appear, 0.8 + 0.2 * appear);
    modeCard(ctx, m, 0, 0, w * 0.18, h * 0.2, false);
    ctx.restore();
  });
}

function modeCard(ctx: Ctx, m: AnswerMode, cx: number, cy: number, cw: number, ch: number, dim: boolean) {
  const info = MODE_LABELS[m];
  ctx.save();
  if (dim) ctx.globalAlpha = 0.35;
  glow(ctx, info.color, ch * 0.2);
  rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, ch * 0.16);
  ctx.fillStyle = info.color + "22";
  ctx.fill();
  ctx.lineWidth = ch * 0.03;
  ctx.strokeStyle = info.color;
  ctx.stroke();
  noGlow(ctx);
  ctx.fillStyle = C.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  font(ctx, ch * 0.42, "display");
  ctx.fillText(m === "solo" ? "SOLO" : `${info.title} RÉP.`, cx, cy - ch * 0.12);
  ctx.fillStyle = info.color;
  font(ctx, ch * 0.2, "text", 900);
  ctx.fillText(`${MODE_POINTS[m]} PTS`, cx, cy + ch * 0.26);
  ctx.restore();
}

function drawRoundIntro(ctx: Ctx, w: number, h: number, s: PublicRoomState, t: number) {
  const p = Math.min(1, t / 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = C.dim;
  font(ctx, h * 0.05, "text", 800);
  ctx.fillText(s.round === s.totalRounds ? "DERNIÈRE MANCHE" : `${QUESTIONS_PER_ROUND} QUESTIONS`, w / 2, h * 0.22);
  ctx.save();
  ctx.translate(w / 2, h * 0.45);
  ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
  glow(ctx, C.coral, 60);
  ctx.fillStyle = C.white;
  font(ctx, h * 0.26, "display");
  ctx.fillText(`MANCHE ${s.round}`, 0, 0);
  ctx.restore();
  noGlow(ctx);
  const boosted = s.players.filter((pl) => pl.modifiers.pointsMultiplier !== 1 || pl.modifiers.timeDeltaSec !== 0);
  if (boosted.length && t > 800) {
    font(ctx, h * 0.036, "text", 700);
    ctx.fillStyle = C.amber;
    const txt = boosted
      .map((pl) => {
        const parts = [];
        if (pl.modifiers.pointsMultiplier === 2) parts.push("POINTS x2");
        if (pl.modifiers.pointsMultiplier === 0.5) parts.push("DEMI-POINTS");
        if (pl.modifiers.timeDeltaSec) parts.push(`${pl.modifiers.timeDeltaSec > 0 ? "+" : ""}${pl.modifiers.timeDeltaSec} S`);
        return `${pl.name.toUpperCase()} : ${parts.join(" · ")}`;
      })
      .join("     ");
    fitLine(ctx, txt, w / 2, h * 0.7, w * 0.9, h * 0.036, "text", 800);
  }
  ctx.fillStyle = C.dim;
  font(ctx, h * 0.034, "text", 700);
  ctx.fillText("2 RÉPONSES = 50   ·   4 RÉPONSES = 100   ·   SOLO = 200", w / 2, h * 0.86);
}

function drawQuestion(ctx: Ctx, w: number, h: number, s: PublicRoomState, now: number) {
  const q = s.question!;
  header(ctx, w, h, s, catLabel(q.category));
  if (!q.text) {
    // Annonce de la question par l'animateur
    const t = now - s.phaseStartedAt;
    const p = Math.min(1, t / 500);
    ctx.save();
    ctx.translate(w / 2, h * 0.47);
    ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    glow(ctx, C.cyan, 50);
    ctx.fillStyle = C.white;
    font(ctx, h * 0.2, "display");
    ctx.fillText(`QUESTION ${q.inRound + 1}`, 0, 0);
    ctx.restore();
    noGlow(ctx);
    const d = DIFFICULTY_LABELS[q.difficulty];
    pill(ctx, `${"★".repeat(q.difficulty)}${"☆".repeat(4 - q.difficulty)}  ${d.label.toUpperCase()}`, w / 2, h * 0.72, h * 0.036, d.color + "33", d.color, d.color);
    return;
  }
  // chrono à zéro : verrouillage (la révélation suit)
  if (now >= q.endsAt) return drawLock(ctx, w, h, now - q.endsAt);
  // texte de la question
  const box = { x: w * 0.07, y: h * 0.16, w: w * 0.86, h: h * 0.42 };
  rr(ctx, box.x - w * 0.02, box.y - h * 0.02, box.w + w * 0.04, box.h + h * 0.04, h * 0.04);
  ctx.fillStyle = "#00000055";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.cyan + "66";
  ctx.stroke();
  fitText(ctx, q.text, box, { max: h * 0.095, min: h * 0.045, weight: 800 });
  // chrono
  const remaining = Math.max(0, q.endsAt - now);
  const secs = Math.ceil(remaining / 1000);
  const total = q.endsAt - q.startsAt;
  // chrono géant : pulsation à chaque seconde, rouge sur les 3 dernières
  const frac = (remaining % 1000) / 1000;
  const beat = 1 + Math.pow(frac, 6) * (secs <= 3 ? 0.14 : 0.06);
  ctx.save();
  ctx.translate(w / 2, h * 0.775);
  ctx.scale(beat, beat);
  timerRing(ctx, 0, 0, h * 0.15, remaining / total, String(secs), secs <= 3);
  ctx.restore();
  // barre de temps sur toute la largeur de l'écran
  const barColor = secs <= 3 ? C.red : secs <= 6 ? C.amber : C.cyan;
  ctx.fillStyle = "#ffffff18";
  ctx.fillRect(0, h * 0.975, w, h * 0.025);
  glow(ctx, barColor, 20);
  ctx.fillStyle = barColor;
  ctx.fillRect(0, h * 0.975, w * (remaining / total), h * 0.025);
  noGlow(ctx);
  // barème
  MODE_ORDER.forEach((m, i) => {
    pill(ctx, `${MODE_LABELS[m].name} = ${MODE_POINTS[m]}`, w * 0.16, h * (0.7 + i * 0.075), h * 0.028, MODE_LABELS[m].color + "30", C.white, MODE_LABELS[m].color);
  });
  // réponses
  const answered = s.players.filter((p) => p.answered).length;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = answered === s.players.length ? C.green : C.white;
  font(ctx, h * 0.05, "display");
  ctx.fillText(`${answered}/${s.players.length}`, w * 0.9, h * 0.76);
  ctx.fillStyle = C.dim;
  font(ctx, h * 0.026, "text", 700);
  ctx.fillText("ONT RÉPONDU", w * 0.9, h * 0.82);
}

const LOCK_MS = REVEAL_LOCK_MS;

function drawLock(ctx: Ctx, w: number, h: number, t: number) {
  const p = Math.min(1, t / 250);
  ctx.save();
  ctx.fillStyle = `rgba(255, 46, 99, ${0.25 * (1 - Math.min(1, t / 600))})`;
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.scale(1.4 - 0.4 * p, 1.4 - 0.4 * p);
  ctx.globalAlpha = p;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  timerRing(ctx, 0, -h * 0.2, h * 0.1, 0, "0", true);
  glow(ctx, C.coral, 50);
  ctx.fillStyle = C.white;
  font(ctx, h * 0.11, "display");
  ctx.fillText("🔒 LES RÉPONSES", 0, h * 0.02);
  ctx.fillText("SONT VERROUILLÉES", 0, h * 0.15);
  ctx.restore();
  noGlow(ctx);
}

function drawReveal(ctx: Ctx, w: number, h: number, s: PublicRoomState, t0: number) {
  const q = s.question!;
  const r = s.reveal!;
  if (t0 < LOCK_MS) return drawLock(ctx, w, h, t0 + 300);
  const t = t0 - LOCK_MS;
  header(ctx, w, h, s, catLabel(q.category));
  fitText(ctx, q.text, { x: w * 0.08, y: h * 0.14, w: w * 0.84, h: h * 0.14 }, { max: h * 0.05, min: h * 0.03, weight: 700, color: "#c9d1ff" });
  const p = Math.min(1, t / 450);
  ctx.save();
  ctx.translate(w / 2, h * 0.43);
  ctx.scale(0.85 + 0.15 * p, 0.85 + 0.15 * p);
  ctx.globalAlpha = p;
  glow(ctx, C.green, 60);
  rr(ctx, -w * 0.38, -h * 0.13, w * 0.76, h * 0.26, h * 0.05);
  const g = ctx.createLinearGradient(0, -h * 0.13, 0, h * 0.13);
  g.addColorStop(0, "#1fd68f");
  g.addColorStop(1, "#0a8f5c");
  ctx.fillStyle = g;
  ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = "#003320";
  font(ctx, h * 0.03, "text", 900);
  ctx.textAlign = "center";
  ctx.fillText("BONNE RÉPONSE", 0, -h * 0.085);
  ctx.fillStyle = C.white;
  fitLine(ctx, r.correctAnswer.toUpperCase(), 0, h * 0.025, w * 0.7, h * 0.12, "display");
  ctx.restore();
  if (t > 700) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (t - 700) / 500);
    fitText(ctx, r.explanation, { x: w * 0.1, y: h * 0.59, w: w * 0.8, h: h * 0.17 }, { max: h * 0.042, min: h * 0.026, weight: 600, color: C.white });
    ctx.restore();
  }
  // résultats des candidats
  if (t > 1200) {
    const list = s.players.map((p) => ({ p, res: r.results[p.id] }));
    const n = list.length;
    const cw = Math.min(w * 0.2, (w * 0.9) / n);
    list.forEach(({ p, res }, i) => {
      const cx = w / 2 + (i - (n - 1) / 2) * cw;
      const cy = h * 0.87;
      const ok = res?.correct;
      rr(ctx, cx - cw * 0.46, cy - h * 0.06, cw * 0.92, h * 0.12, h * 0.025);
      ctx.fillStyle = ok ? "#0f5c3d" : res?.timedOut ? "#2a2a3a" : "#5c1020";
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.textAlign = "center";
      fitLine(ctx, p.name.toUpperCase(), cx, cy - h * 0.025, cw * 0.85, h * 0.03, "text", 800);
      ctx.fillStyle = ok ? C.green : C.dim;
      const label = ok ? `+${res.points}${res.multiplier !== 1 ? ` (x${res.multiplier})` : ""}` : res?.timedOut ? "TEMPS ÉCOULÉ" : "RATÉ";
      fitLine(ctx, `${res?.mode ? (res.mode === "solo" ? "SOLO" : res.mode) + " · " : ""}${label}`, cx, cy + h * 0.025, cw * 0.85, h * 0.028, "text", 800);
    });
  }
}

function drawRanking(ctx: Ctx, w: number, h: number, s: PublicRoomState, t: number, now: number, title: string) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  glow(ctx, C.amber, 30);
  ctx.fillStyle = C.white;
  font(ctx, h * 0.085, "display");
  ctx.fillText(title, w / 2, h * 0.1);
  noGlow(ctx);
  const rows = s.ranking;
  const n = rows.length;
  const rowH = Math.min(h * 0.1, (h * 0.8) / Math.max(1, n));
  const top = h * 0.19;
  const move = Math.min(1, Math.max(0, (t - 1200) / 1300));
  const ease = move < 0.5 ? 2 * move * move : 1 - Math.pow(-2 * move + 2, 2) / 2;
  const leader = rows[0]?.playerId;
  // du dernier au premier pour que le premier passe au-dessus
  [...rows].reverse().forEach((r) => {
    const appear = Math.min(1, Math.max(0, (t - (n - r.rank) * 90) / 300));
    const y = top + ((r.previousRank - 1) + (r.rank - r.previousRank) * ease) * rowH;
    const p = s.players.find((pl) => pl.id === r.playerId);
    if (!p) return;
    const isLead = r.playerId === leader && move >= 1;
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate((1 - appear) * w * 0.1, 0);
    rr(ctx, w * 0.12, y, w * 0.76, rowH * 0.86, rowH * 0.2);
    const g = ctx.createLinearGradient(w * 0.12, 0, w * 0.88, 0);
    g.addColorStop(0, isLead ? "#6b4a00" : "#1a2356");
    g.addColorStop(1, isLead ? "#2a1d00" : "#0c1233");
    ctx.fillStyle = g;
    if (isLead) glow(ctx, C.amber, 40);
    ctx.fill();
    noGlow(ctx);
    const rank = Math.round(r.previousRank + (r.rank - r.previousRank) * ease);
    const medal = ["🥇", "🥈", "🥉"][rank - 1];
    ctx.fillStyle = isLead ? C.amber : C.white;
    font(ctx, rowH * 0.5, "display");
    ctx.textAlign = "center";
    ctx.fillText(medal ?? String(rank), w * 0.17, y + rowH * 0.44);
    ctx.textAlign = "left";
    ctx.fillStyle = C.white;
    font(ctx, rowH * 0.4, "text", 800);
    ctx.fillText(p.name.toUpperCase(), w * 0.22, y + rowH * 0.44);
    if (r.roundScore > 0 && s.phase === "leaderboard") {
      ctx.fillStyle = C.green;
      font(ctx, rowH * 0.3, "text", 800);
      ctx.fillText(`+${formatScore(r.roundScore)} cette manche`, w * 0.5, y + rowH * 0.44);
    }
    const display = t < 1200 ? r.previousScore : tweenScore(`rank-${r.playerId}`, r.score, now, 1300);
    ctx.textAlign = "right";
    ctx.fillStyle = isLead ? C.amber : C.cyan;
    font(ctx, rowH * 0.48, "display");
    ctx.fillText(formatScore(display), w * 0.85, y + rowH * 0.44);
    ctx.restore();
    if (t < 1200) tweenScore(`rank-${r.playerId}`, r.previousScore, now);
  });
}

function drawWheelScreen(ctx: Ctx, w: number, h: number, s: PublicRoomState, now: number) {
  const wh = s.wheel!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  glow(ctx, C.coral, 40);
  ctx.fillStyle = C.white;
  font(ctx, h * 0.11, "display");
  ctx.fillText("ROUE BONUS / MALUS", w / 2, h * 0.15);
  noGlow(ctx);
  const spinner = playerName(s, wh.spinnerId).toUpperCase();
  ctx.fillStyle = C.amber;
  font(ctx, h * 0.05, "text", 900);
  ctx.fillText(`🏆 ${spinner} A REMPORTÉ LA MANCHE`, w / 2, h * 0.28);
  const seg = wh.resultIndex !== null ? WHEEL_SEGMENTS[wh.resultIndex] : null;
  const spinEnd = (wh.spinStartedAt ?? 0) + wh.spinDurationMs;
  if (wh.stage === "intro" || wh.stage === "waiting_spin") {
    ctx.fillStyle = C.white;
    font(ctx, h * 0.07, "display");
    const pulse = 1 + Math.sin(now / 200) * 0.04;
    ctx.save();
    ctx.translate(w / 2, h * 0.55);
    ctx.scale(pulse, pulse);
    ctx.fillText(`${spinner}, À VOUS DE TOURNER LA ROUE !`, 0, 0);
    ctx.restore();
  } else if (wh.stage === "spinning" && now < spinEnd) {
    ctx.fillStyle = C.white;
    font(ctx, h * 0.09, "display");
    ctx.fillText("LA ROUE TOURNE…", w / 2, h * 0.55);
  } else if (seg) {
    const tone = WHEEL_TONE_COLORS[seg.tone];
    rr(ctx, w * 0.15, h * 0.38, w * 0.7, h * 0.3, h * 0.05);
    glow(ctx, tone.bg, 60);
    ctx.fillStyle = tone.bg;
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = tone.text;
    font(ctx, h * 0.13, "display");
    ctx.fillText(seg.label, w / 2, h * 0.48);
    font(ctx, h * 0.055, "text", 900);
    ctx.fillText(seg.line2, w / 2, h * 0.6);
    if (wh.stage === "choose_target") {
      ctx.fillStyle = C.white;
      font(ctx, h * 0.06, "display");
      const pulse = 1 + Math.sin(now / 180) * 0.05;
      ctx.save();
      ctx.translate(w / 2, h * 0.8);
      ctx.scale(pulse, pulse);
      ctx.fillText(`${spinner}, CHOISISSEZ VOTRE CIBLE !`, 0, 0);
      ctx.restore();
    } else if (wh.outcome) {
      fitText(ctx, wh.outcome.text, { x: w * 0.08, y: h * 0.72, w: w * 0.84, h: h * 0.18 }, { max: h * 0.06, min: h * 0.03, weight: 900, color: wh.outcome.blockedByShield ? C.cyan : C.white });
    }
  }
}

function drawFinal(ctx: Ctx, w: number, h: number, s: PublicRoomState, t: number, now: number) {
  const rows = s.ranking;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  glow(ctx, C.amber, 50);
  ctx.fillStyle = C.white;
  font(ctx, h * 0.095, "display");
  ctx.fillText("CLASSEMENT FINAL", w / 2, h * 0.1);
  noGlow(ctx);
  // podium top 3
  const podium = [
    { r: rows[1], x: w * 0.25, hh: h * 0.2, delay: 1200 },
    { r: rows[0], x: w * 0.5, hh: h * 0.3, delay: 2400 },
    { r: rows[2], x: w * 0.75, hh: h * 0.14, delay: 600 },
  ];
  podium.forEach(({ r, x, hh, delay }) => {
    if (!r) return;
    const p = s.players.find((pl) => pl.id === r.playerId);
    if (!p) return;
    const a = Math.min(1, Math.max(0, (t - delay) / 600));
    if (a <= 0) return;
    const base = h * 0.78;
    const colW = w * 0.2;
    const colors = ["#ffb800", "#c7d0e0", "#d98a4a"];
    const col = colors[r.rank - 1] ?? C.cyan;
    ctx.save();
    ctx.globalAlpha = a;
    rr(ctx, x - colW / 2, base - hh * a, colW, hh * a, 16);
    ctx.fillStyle = col + "55";
    glow(ctx, col, r.rank === 1 ? 50 : 20);
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = col;
    font(ctx, h * 0.09, "display");
    ctx.fillText(String(r.rank), x, base - hh * a + h * 0.07);
    ctx.fillStyle = C.white;
    fitLine(ctx, p.name.toUpperCase(), x, base - hh * a - h * 0.1, colW * 1.1, h * 0.05, "display");
    ctx.fillStyle = col;
    font(ctx, h * 0.04, "text", 900);
    ctx.fillText(`${formatScore(tweenScore(`final-${p.id}`, r.score, now, 1500))} PTS`, x, base - hh * a - h * 0.045);
    ctx.restore();
  });
  const rest = rows.slice(3);
  if (rest.length && t > 3200) {
    font(ctx, h * 0.03, "text", 700);
    ctx.fillStyle = C.dim;
    const txt = rest.map((r) => `${r.rank}. ${playerName(s, r.playerId)} — ${formatScore(r.score)}`).join("     ");
    fitLine(ctx, txt, w / 2, h * 0.88, w * 0.9, h * 0.032, "text", 700);
  }
  if (t > 3000) {
    ctx.fillStyle = C.amber;
    font(ctx, h * 0.04, "text", 900);
    const winner = playerName(s, rows[0]?.playerId).toUpperCase();
    ctx.fillText(`👑 ${winner} REMPORTE QUIZZ MASTER ! 👑`, w / 2, h * 0.95);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PUPITRES
// ═════════════════════════════════════════════════════════════════════════════

export function podiumFrontSig(p: PublicPlayer | null, s: PublicRoomState | null, now: number, color: string) {
  if (!p || !s) return `empty|${fontsVersion}`;
  const tick = isTweening(`pod-${p.id}`, now) ? Math.floor(now / 200) : s.phase === "wheel" && s.wheel?.stage === "choose_target" ? Math.floor(now / 250) : 0;
  const locked = s.phase === "reveal" && now - s.phaseStartedAt < REVEAL_LOCK_MS;
  return [p.name, p.score, p.mode, p.answered, p.connected, s.phase, locked, s.reveal?.questionIndex, p.lastResult?.questionIndex, p.modifiers.shield, p.modifiers.pointsMultiplier, tick, color, fontsVersion, s.wheel?.stage, s.wheel?.targetId].join("|");
}

/** Face avant du pupitre (vue par le public et les caméras) : PSEUDO + SCORE + état. */
export function drawPodiumFront(ctx: Ctx, w: number, h: number, p: PublicPlayer | null, s: PublicRoomState | null, now: number, color: string, isMe: boolean) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0d1440");
  g.addColorStop(1, "#050818");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!p || !s) {
    ctx.fillStyle = "#ffffff18";
    font(ctx, h * 0.3, "display");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LIBRE", w / 2, h / 2);
    return;
  }
  let frame = color;
  const res = p.lastResult;
  const locked = s.phase === "reveal" && now - s.phaseStartedAt < LOCK_MS;
  const revealing = s.phase === "reveal" && !locked && res && res.questionIndex === s.reveal?.questionIndex;
  if (revealing) frame = res!.correct ? C.green : C.red;
  if (s.phase === "wheel" && s.wheel?.stage === "choose_target" && p.id !== s.wheel.spinnerId) frame = Math.floor(now / 250) % 2 ? C.coral : C.white;
  // cadre lumineux
  ctx.lineWidth = h * 0.05;
  glow(ctx, frame, h * 0.12);
  ctx.strokeStyle = frame;
  rr(ctx, h * 0.04, h * 0.04, w - h * 0.08, h - h * 0.08, h * 0.1);
  ctx.stroke();
  noGlow(ctx);
  // pseudo
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = p.connected ? C.white : C.dim;
  fitLine(ctx, p.name.toUpperCase(), w / 2, h * 0.27, w * 0.84, h * 0.24, "display");
  // score animé
  // pendant le verrouillage, le score n'a pas encore « bougé » à l'antenne
  const shown = locked && res && res.questionIndex === s.reveal?.questionIndex ? p.score - res.points : p.score;
  const display = tweenScore(`pod-${p.id}`, shown, now);
  ctx.fillStyle = color;
  glow(ctx, color, h * 0.08);
  fitLine(ctx, `${formatScore(display)} PTS`, w / 2, h * 0.58, w * 0.86, h * 0.26, "display");
  noGlow(ctx);
  // ligne d'état
  let status = "";
  let statusColor = C.dim;
  if (s.phase === "question") {
    if (p.answered) {
      status = `✓ ${p.mode === "solo" ? "SOLO" : p.mode + " RÉP."} · VERROUILLÉ`;
      statusColor = C.green;
    } else if (p.mode) {
      status = p.mode === "solo" ? "✍ SOLO — 200" : `${p.mode} RÉPONSES — ${MODE_POINTS[p.mode]}`;
      statusColor = MODE_LABELS[p.mode].color;
    } else {
      status = "RÉFLÉCHIT…";
      statusColor = C.white;
    }
  } else if (locked) {
    status = "🔒 VERROUILLÉ";
    statusColor = C.white;
  } else if (revealing) {
    status = res!.correct ? `BONNE RÉPONSE  +${res!.points}` : res!.timedOut ? "TEMPS ÉCOULÉ" : "MAUVAISE RÉPONSE";
    statusColor = res!.correct ? C.green : C.red;
  } else if (!p.connected) {
    status = "DÉCONNECTÉ";
  } else {
    const tags = [];
    if (p.modifiers.shield) tags.push("🛡 BOUCLIER");
    if (p.modifiers.pointsMultiplier === 2 || p.modifiers.pending.pointsMultiplier === 2) tags.push("x2");
    if (p.modifiers.pointsMultiplier === 0.5 || p.modifiers.pending.pointsMultiplier === 0.5) tags.push("½");
    const td = p.modifiers.timeDeltaSec || p.modifiers.pending.timeDeltaSec;
    if (td) tags.push(`${td > 0 ? "+" : ""}${td}s`);
    status = tags.join("  ") || (isMe ? "C'EST VOUS" : p.isHost && s.phase === "lobby" ? "HÔTE" : "");
    statusColor = tags.length ? C.amber : C.cyan;
  }
  if (status) {
    ctx.fillStyle = statusColor;
    fitLine(ctx, status, w / 2, h * 0.83, w * 0.84, h * 0.13, "text", 900);
  }
}

export function podiumTopSig(p: PublicPlayer | null, s: PublicRoomState | null, priv: PrivateState | null, now: number) {
  if (!p || !s) return `e|${fontsVersion}`;
  // écran du joueur local : chrono animé ; écrans des adversaires : redessinés seulement quand leur état change
  const tick = s.phase === "question" && priv ? Math.floor(now / 250) : 0;
  return [s.phase, p.mode, p.answered, priv?.options.join(","), priv?.answer, s.reveal?.questionIndex, p.score, tick, fontsVersion].join("|");
}

/** Écran incliné du pupitre, orienté vers le candidat : son interface personnelle. */
export function drawPodiumTop(ctx: Ctx, w: number, h: number, p: PublicPlayer | null, s: PublicRoomState | null, priv: PrivateState | null, now: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#050a22";
  ctx.fillRect(0, 0, w, h);
  if (!p || !s) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (s.phase === "question" && s.question) {
    const deadline = p.deadline ?? s.question.endsAt;
    const total = deadline - s.question.startsAt;
    const remaining = Math.max(0, deadline - Math.max(now, s.question.startsAt));
    // barre de temps
    rr(ctx, w * 0.05, h * 0.06, w * 0.9, h * 0.08, h * 0.04);
    ctx.fillStyle = "#ffffff22";
    ctx.fill();
    rr(ctx, w * 0.05, h * 0.06, w * 0.9 * (remaining / total), h * 0.08, h * 0.04);
    ctx.fillStyle = remaining < 3000 ? C.red : C.cyan;
    ctx.fill();
    ctx.fillStyle = C.white;
    font(ctx, h * 0.13, "display");
    ctx.fillText(String(Math.ceil(remaining / 1000)), w / 2, h * 0.26);
    if (!s.question.text) {
      font(ctx, h * 0.1, "text", 800);
      ctx.fillText("PRÉPAREZ-VOUS…", w / 2, h * 0.6);
      return;
    }
    if (!p.mode) {
      MODE_ORDER.forEach((m, i) => {
        const cx = w * (0.19 + i * 0.31);
        const info = MODE_LABELS[m];
        rr(ctx, cx - w * 0.14, h * 0.4, w * 0.28, h * 0.5, h * 0.06);
        ctx.fillStyle = info.color;
        ctx.fill();
        ctx.fillStyle = "#0a0a14";
        font(ctx, h * 0.17, "display");
        ctx.fillText(info.title, cx, h * 0.58);
        font(ctx, h * 0.08, "text", 900);
        ctx.fillText(`${MODE_POINTS[m]} PTS`, cx, h * 0.78);
      });
      return;
    }
    const info = MODE_LABELS[p.mode];
    ctx.fillStyle = info.color;
    font(ctx, h * 0.08, "text", 900);
    ctx.fillText(p.mode === "solo" ? "MODE SOLO — 200 PTS" : `${p.mode} RÉPONSES — ${MODE_POINTS[p.mode]} PTS`, w / 2, h * 0.4);
    if (p.answered) {
      ctx.fillStyle = C.green;
      font(ctx, h * 0.12, "display");
      ctx.fillText("✓ RÉPONSE VERROUILLÉE", w / 2, h * 0.62);
      if (priv?.answer) {
        ctx.fillStyle = C.white;
        fitLine(ctx, priv.answer.toUpperCase(), w / 2, h * 0.82, w * 0.9, h * 0.1, "text", 800);
      }
      return;
    }
    if (priv && priv.options.length) {
      const n = priv.options.length;
      priv.options.forEach((o, i) => {
        const col = n === 4 ? i % 2 : i;
        const row = n === 4 ? Math.floor(i / 2) : 0;
        const bw = w * 0.44;
        const bh = n === 4 ? h * 0.2 : h * 0.34;
        const x = w * 0.04 + col * w * 0.48;
        const y = h * 0.5 + row * h * 0.24;
        rr(ctx, x, y, bw, bh, h * 0.04);
        ctx.fillStyle = "#1a2a6a";
        ctx.fill();
        ctx.fillStyle = C.white;
        fitLine(ctx, `${"ABCD"[i]}  ${o}`, x + bw / 2, y + bh / 2, bw * 0.9, h * 0.08, "text", 800);
      });
    } else {
      ctx.fillStyle = C.white;
      font(ctx, h * 0.1, "text", 800);
      ctx.fillText(p.mode === "solo" ? "✍ ÉCRIVEZ VOTRE RÉPONSE" : "…", w / 2, h * 0.68);
    }
    return;
  }
  // hors question : pseudo + score
  ctx.fillStyle = C.white;
  fitLine(ctx, p.name.toUpperCase(), w / 2, h * 0.35, w * 0.9, h * 0.22, "display");
  ctx.fillStyle = C.cyan;
  font(ctx, h * 0.18, "display");
  ctx.fillText(`${formatScore(p.score)} PTS`, w / 2, h * 0.68);
}

// ═════════════════════════════════════════════════════════════════════════════
// PANNEAU LED « CLASSEMENT EN DIRECT »
// ═════════════════════════════════════════════════════════════════════════════

export function livePanelSig(s: PublicRoomState | null, now: number) {
  if (!s) return `n|${fontsVersion}`;
  const anim = s.ranking.some((r) => isTweening(`live-${r.playerId}`, now)) ? Math.floor(now / 80) : 0;
  return [s.phase === "reveal" && now - s.phaseStartedAt < REVEAL_LOCK_MS, s.ranking.map((r) => `${r.playerId}:${r.score}:${r.rank}`).join(","), s.players.map((p) => p.name).join(","), anim, fontsVersion, Math.floor(now / 2000)].join("|");
}

export function drawLivePanel(ctx: Ctx, w: number, h: number, s: PublicRoomState | null, now: number, colors: Record<string, string>) {
  screenBackground(ctx, w, h, "#1a1040", now);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = C.white;
  glow(ctx, C.coral, 20);
  font(ctx, h * 0.07, "display");
  ctx.fillText("CLASSEMENT EN DIRECT", w / 2, h * 0.08);
  noGlow(ctx);
  if (!s) return;
  const ranking = s.ranking.length ? s.ranking : s.players.map((p, i) => ({ playerId: p.id, rank: i + 1, score: p.score }));
  const rowH = (h * 0.84) / 8;
  ranking.slice(0, 8).forEach((r, i) => {
    const p = s.players.find((pl) => pl.id === r.playerId);
    if (!p) return;
    const y = h * 0.15 + i * rowH;
    rr(ctx, w * 0.04, y, w * 0.92, rowH * 0.84, rowH * 0.2);
    ctx.fillStyle = i === 0 ? "#5a3d00" : "#ffffff10";
    ctx.fill();
    rr(ctx, w * 0.06, y + rowH * 0.12, rowH * 0.6, rowH * 0.6, rowH * 0.12);
    ctx.fillStyle = i === 0 ? C.amber : colors[p.id] ?? C.cyan;
    ctx.fill();
    ctx.fillStyle = "#0a0a14";
    font(ctx, rowH * 0.42, "display");
    ctx.fillText(String(r.rank), w * 0.06 + rowH * 0.3, y + rowH * 0.43);
    ctx.textAlign = "left";
    ctx.fillStyle = C.white;
    fitLine(ctx, p.name, w * 0.06 + rowH * 0.8, y + rowH * 0.43, w * 0.45, rowH * 0.4, "text", 800);
    ctx.textAlign = "right";
    ctx.fillStyle = i === 0 ? C.amber : C.cyan;
    font(ctx, rowH * 0.42, "display");
    const pending = s.phase === "reveal" && now - s.phaseStartedAt < LOCK_MS ? p.lastResult?.points ?? 0 : 0;
    ctx.fillText(formatScore(tweenScore(`live-${p.id}`, r.score - pending, now)), w * 0.93, y + rowH * 0.43);
    ctx.textAlign = "center";
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUE ET SOL
// ═════════════════════════════════════════════════════════════════════════════

export function drawWheelFace(ctx: Ctx, size: number) {
  const r = size / 2;
  const n = WHEEL_SEGMENTS.length;
  const seg = (Math.PI * 2) / n;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(r, r);
  WHEEL_SEGMENTS.forEach((s, i) => {
    const a0 = -Math.PI / 2 + i * seg;
    const tone = WHEEL_TONE_COLORS[s.tone];
    const g = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
    g.addColorStop(0, tone.bg2);
    g.addColorStop(0.55, tone.bg);
    g.addColorStop(1, tone.bg2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.98, a0, a0 + seg);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = r * 0.012;
    ctx.strokeStyle = "#fff8";
    ctx.stroke();
    // libellé radial
    ctx.save();
    ctx.rotate(a0 + seg / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = tone.text;
    ctx.shadowColor = "#0008";
    ctx.shadowBlur = 8;
    fitLine(ctx, s.label, r * 0.9, -r * 0.045, r * 0.55, r * 0.1, "display");
    ctx.globalAlpha = 0.95;
    fitLine(ctx, s.line2, r * 0.9, r * 0.06, r * 0.5, r * 0.052, "text", 900);
    ctx.restore();
  });
  // moyeu
  const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.2);
  hub.addColorStop(0, "#ffffff");
  hub.addColorStop(1, "#b7c2ff");
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = "#0b1030";
  ctx.fill();
  ctx.lineWidth = r * 0.02;
  ctx.strokeStyle = C.cyan;
  ctx.stroke();
  ctx.restore();
  drawLogo(ctx, r, r, r * 0.07);
}

export function drawFloor(ctx: Ctx, size: number) {
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "#1b2a7a");
  g.addColorStop(0.5, "#0b1440");
  g.addColorStop(1, "#050818");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  // anneaux et rayons
  ctx.strokeStyle = "#29e7ff55";
  for (let i = 1; i <= 6; i++) {
    ctx.lineWidth = i % 2 ? 3 : 6;
    ctx.beginPath();
    ctx.arc(r, r, (r * i) / 6.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#ffffff12";
  ctx.lineWidth = 2;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(r + Math.cos(a) * r * 0.32, r + Math.sin(a) * r * 0.32);
    ctx.lineTo(r + Math.cos(a) * r * 0.98, r + Math.sin(a) * r * 0.98);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(r, r * 1.02);
  drawLogo(ctx, 0, 0, size * 0.075);
  ctx.restore();
}
