// Logo « QUIZZ MASTER » couronné, dessiné sur canvas (menu, décor 3D).
import { FONTS } from "./draw";

export function drawCrown(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, baseY - h, 0, baseY);
  g.addColorStop(0, "#fff4c2");
  g.addColorStop(0.45, "#f5c542");
  g.addColorStop(1, "#a86b12");
  ctx.beginPath();
  const x0 = cx - w / 2;
  ctx.moveTo(x0, baseY);
  ctx.lineTo(x0 - w * 0.02, baseY - h * 0.72);
  ctx.lineTo(x0 + w * 0.22, baseY - h * 0.38);
  ctx.lineTo(cx, baseY - h);
  ctx.lineTo(x0 + w * 0.78, baseY - h * 0.38);
  ctx.lineTo(x0 + w * 1.02, baseY - h * 0.72);
  ctx.lineTo(x0 + w, baseY);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(255,190,60,0.9)";
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = w * 0.02;
  ctx.strokeStyle = "#7a4a08";
  ctx.stroke();
  // bandeau et joyaux
  ctx.fillStyle = "#c98d1c";
  ctx.fillRect(x0 + w * 0.04, baseY - h * 0.16, w * 0.92, h * 0.12);
  for (const [px, py, r, col] of [
    [cx, baseY - h, h * 0.09, "#ffffff"],
    [x0 - w * 0.02, baseY - h * 0.72, h * 0.07, "#ffffff"],
    [x0 + w * 1.02, baseY - h * 0.72, h * 0.07, "#ffffff"],
    [cx, baseY - h * 0.1, h * 0.07, "#3a86ff"],
    [cx - w * 0.28, baseY - h * 0.1, h * 0.05, "#ff2e63"],
    [cx + w * 0.28, baseY - h * 0.1, h * 0.05, "#2ee59d"],
  ] as const) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
}

function drawTitle(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, maxW: number) {
  ctx.font = `italic 900 ${size}px ${FONTS.display}`;
  const w = ctx.measureText(text).width;
  const s = Math.min(1, maxW / w);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // relief
  for (let i = 10; i > 0; i -= 2) {
    ctx.fillStyle = i > 4 ? "#0a1238" : "#1b2a78";
    ctx.fillText(text, 0, i * size * 0.012);
  }
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.55, "#e9eeff");
  g.addColorStop(1, "#aebcf0");
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.09;
  ctx.strokeStyle = "#c98d1c";
  ctx.strokeText(text, 0, 0);
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = "#ffe08a";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function drawQuizzMasterLogo(ctx: CanvasRenderingContext2D, size: number, badge = true) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  if (badge) {
    // halo bleu
    ctx.save();
    ctx.shadowColor = "rgba(60,140,255,0.95)";
    ctx.shadowBlur = size * 0.05;
    ctx.beginPath();
    ctx.arc(c, c * 1.04, size * 0.445, 0, Math.PI * 2);
    ctx.strokeStyle = "#5aa8ff";
    ctx.lineWidth = size * 0.012;
    ctx.stroke();
    ctx.restore();
    // disque
    const rg = ctx.createRadialGradient(c, c * 0.95, size * 0.05, c, c * 1.04, size * 0.43);
    rg.addColorStop(0, "#1f3596");
    rg.addColorStop(0.6, "#0d1a5a");
    rg.addColorStop(1, "#050a26");
    ctx.beginPath();
    ctx.arc(c, c * 1.04, size * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
    // anneau doré
    const gg = ctx.createLinearGradient(0, size * 0.1, 0, size * 0.95);
    gg.addColorStop(0, "#fff1b0");
    gg.addColorStop(0.35, "#e0a52a");
    gg.addColorStop(0.6, "#8a5a10");
    gg.addColorStop(1, "#ffd970");
    ctx.save();
    ctx.shadowColor = "rgba(255,190,60,0.8)";
    ctx.shadowBlur = size * 0.03;
    ctx.beginPath();
    ctx.arc(c, c * 1.04, size * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = gg;
    ctx.lineWidth = size * 0.028;
    ctx.stroke();
    ctx.restore();
  }
  drawCrown(ctx, c, size * 0.31, size * 0.34, size * 0.2);
  drawTitle(ctx, "QUIZZ", c, size * 0.5, size * 0.21, size * 0.74);
  drawTitle(ctx, "MASTER", c, size * 0.7, size * 0.19, size * 0.8);
}

