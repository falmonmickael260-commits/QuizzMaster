// Écran central du plateau-image : mise en page à gros caractères (il est plus petit que l'ancien grand écran 3D).
import { REVEAL_LOCK_MS } from "@shared/config";
import { CATEGORY_BY_ID } from "@shared/categories";
import type { PublicRoomState } from "@shared/types";
import { WHEEL_SEGMENTS } from "@shared/wheel";
import { C, drawLogo, fitLine, fitText, fontsVersion, formatScore, glow, noGlow, rr, type Ctx } from "./draw";

export function centerScreenSig(s: PublicRoomState | null, now: number): string {
  if (!s) return `none|${fontsVersion}`;
  const t = now - s.phaseStartedAt;
  const q = s.question;
  // le chrono en barre avance 10 fois par seconde pendant la question
  const tick = s.phase === "question" && q?.text ? Math.floor(now / 100) : s.phase === "reveal" ? Math.floor(Math.min(t, REVEAL_LOCK_MS + 200) / 200) : 0;
  return [s.phase, s.phaseStartedAt, q?.index, !!q?.text, s.reveal?.questionIndex, s.wheel?.stage, s.wheel?.outcome?.text, s.ranking.map((r) => r.score).join(","), s.players.length, tick, fontsVersion].join("|");
}

function background(ctx: Ctx, w: number, h: number, tint: string) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, tint);
  g.addColorStop(1, "#040822");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // léger quadrillage « écran LED »
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2);
}

function header(ctx: Ctx, w: number, h: number, left: string, right: string) {
  ctx.fillStyle = "rgba(255,201,74,0.9)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  fitLine(ctx, left.toUpperCase(), w * 0.04, h * 0.09, w * 0.6, h * 0.075, "display");
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(220,230,255,0.85)";
  fitLine(ctx, right.toUpperCase(), w * 0.96, h * 0.09, w * 0.34, h * 0.065, "display");
}

export function drawCenterScreen(ctx: Ctx, w: number, h: number, s: PublicRoomState | null, now: number) {
  ctx.save();
  noGlow(ctx);
  if (!s || s.phase === "lobby" || s.phase === "intro") {
    background(ctx, w, h, "#0f1e66");
    drawLogo(ctx, w / 2, h * 0.42, h * 0.22);
    ctx.fillStyle = "#dfe7ff";
    ctx.textAlign = "center";
    fitLine(ctx, s?.phase === "lobby" ? `CODE ${s.code}` : "BIENVENUE SUR LE PLATEAU", w / 2, h * 0.72, w * 0.8, h * 0.1, "display");
    ctx.restore();
    return;
  }
  const q = s.question;
  const cat = q ? CATEGORY_BY_ID[q.category] : null;
  const t = now - s.phaseStartedAt;
  const where = `Manche ${s.round}/${s.totalRounds} · Q${Math.max(1, s.questionNumber)}/${s.totalQuestions}`;

  if (s.phase === "round_intro") {
    background(ctx, w, h, "#16236f");
    ctx.textAlign = "center";
    glow(ctx, "#ffb52e", h * 0.05);
    ctx.fillStyle = "#ffc94a";
    fitLine(ctx, `MANCHE ${s.round}`, w / 2, h * 0.42, w * 0.8, h * 0.28, "display");
    noGlow(ctx);
    ctx.fillStyle = "#dfe7ff";
    fitLine(ctx, "5 QUESTIONS · CHOISISSEZ VOTRE AIDE", w / 2, h * 0.7, w * 0.86, h * 0.08, "display");
  } else if (s.phase === "question" && q) {
    background(ctx, w, h, "#10205a");
    header(ctx, w, h, cat ? `${cat.emoji} ${cat.label}` : "Question", where);
    if (!q.text) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      fitLine(ctx, `QUESTION ${q.inRound + 1}`, w / 2, h * 0.5, w * 0.8, h * 0.22, "display");
    } else {
      // chrono en barre sous l'en-tête (le compte à rebours précis est dans le panneau du bas)
      const ratio = Math.max(0, Math.min(1, (q.endsAt - Math.max(now, q.startsAt)) / (q.endsAt - q.startsAt)));
      rr(ctx, w * 0.04, h * 0.17, w * 0.92, h * 0.035, h * 0.018);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
      fitText(ctx, q.text, { x: w * 0.06, y: h * 0.24, w: w * 0.88, h: h * 0.6 }, { max: h * 0.16, min: h * 0.06, kind: "text", weight: 800 });
      if (ratio > 0) {
        rr(ctx, w * 0.04, h * 0.17, w * 0.92 * ratio, h * 0.035, h * 0.018);
        ctx.fillStyle = ratio < 0.25 ? "#ff4d4d" : "#29e7ff";
        ctx.fill();
      }
    }
  } else if (s.phase === "reveal" && s.reveal) {
    const locked = t < REVEAL_LOCK_MS;
    background(ctx, w, h, locked ? "#3a0d1a" : "#0d3a2a");
    header(ctx, w, h, cat ? `${cat.emoji} ${cat.label}` : "Réponse", where);
    ctx.textAlign = "center";
    if (locked) {
      ctx.fillStyle = "#ffffff";
      fitLine(ctx, "🔒 RÉPONSES VERROUILLÉES", w / 2, h * 0.52, w * 0.86, h * 0.13, "display");
    } else {
      ctx.fillStyle = "#b6f5cf";
      fitLine(ctx, "BONNE RÉPONSE", w / 2, h * 0.27, w * 0.8, h * 0.08, "display");
      rr(ctx, w * 0.08, h * 0.37, w * 0.84, h * 0.3, h * 0.05);
      const g = ctx.createLinearGradient(0, h * 0.37, 0, h * 0.67);
      g.addColorStop(0, "#2ee37a");
      g.addColorStop(1, "#15a34a");
      ctx.fillStyle = g;
      glow(ctx, "#22c55e", h * 0.06);
      ctx.fill();
      noGlow(ctx);
      ctx.fillStyle = "#ffffff";
      fitLine(ctx, s.reveal.correctAnswer.toUpperCase(), w / 2, h * 0.52, w * 0.78, h * 0.16, "display");
      const ok = Object.values(s.reveal.results).filter((r) => r.correct).length;
      ctx.fillStyle = "#dfe7ff";
      fitLine(ctx, `${ok}/${s.players.length} BONNE${ok > 1 ? "S" : ""} RÉPONSE${ok > 1 ? "S" : ""}`, w / 2, h * 0.8, w * 0.8, h * 0.075, "display");
    }
  } else if (s.phase === "leaderboard" || (s.phase === "wheel" && s.wheel?.stage !== "result")) {
    background(ctx, w, h, s.phase === "wheel" ? "#3a0d3a" : "#16236f");
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffc94a";
    fitLine(ctx, s.phase === "wheel" ? "ROUE BONUS / MALUS" : `CLASSEMENT · MANCHE ${s.round}`, w / 2, h * 0.11, w * 0.9, h * 0.1, "display");
    const rows = [...s.ranking].sort((a, b) => a.rank - b.rank).slice(0, 5);
    rows.forEach((r, i) => {
      const p = s.players.find((x) => x.id === r.playerId);
      const y = h * (0.28 + i * 0.145);
      rr(ctx, w * 0.07, y - h * 0.06, w * 0.86, h * 0.12, h * 0.03);
      ctx.fillStyle = i === 0 ? "rgba(255,201,74,0.28)" : "rgba(255,255,255,0.07)";
      ctx.fill();
      ctx.textAlign = "left";
      ctx.fillStyle = i === 0 ? "#ffc94a" : "#ffffff";
      fitLine(ctx, `${r.rank}. ${(p?.name ?? "?").toUpperCase()}`, w * 0.1, y, w * 0.55, h * 0.085, "display");
      ctx.textAlign = "right";
      fitLine(ctx, formatScore(r.score), w * 0.9, y, w * 0.25, h * 0.085, "display");
    });
  } else if (s.phase === "wheel" && s.wheel?.outcome) {
    background(ctx, w, h, "#3a0d3a");
    const seg = WHEEL_SEGMENTS.find((x) => x.id === s.wheel!.outcome!.segmentId);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffc94a";
    fitLine(ctx, seg ? `${seg.label} ${seg.line2}` : "ROUE", w / 2, h * 0.3, w * 0.86, h * 0.16, "display");
    fitText(ctx, s.wheel.outcome.text, { x: w * 0.08, y: h * 0.45, w: w * 0.84, h: h * 0.4 }, { max: h * 0.1, min: h * 0.05, kind: "text", weight: 800 });
  } else if (s.phase === "final") {
    background(ctx, w, h, "#3a2a08");
    const top = [...s.ranking].sort((a, b) => a.rank - b.rank)[0];
    const winner = s.players.find((p) => p.id === top?.playerId);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a0";
    fitLine(ctx, "👑 GRANDE FINALE 👑", w / 2, h * 0.18, w * 0.86, h * 0.1, "display");
    glow(ctx, "#ffb52e", h * 0.06);
    ctx.fillStyle = "#ffc94a";
    fitLine(ctx, (winner?.name ?? "").toUpperCase(), w / 2, h * 0.47, w * 0.86, h * 0.26, "display");
    noGlow(ctx);
    ctx.fillStyle = "#ffffff";
    fitLine(ctx, `REMPORTE QUIZZ MASTER · ${formatScore(top?.score ?? 0)} PTS`, w / 2, h * 0.76, w * 0.9, h * 0.08, "display");
  } else {
    background(ctx, w, h, "#0f1e66");
    drawLogo(ctx, w / 2, h * 0.5, h * 0.22);
  }
  ctx.restore();
  void C;
}
