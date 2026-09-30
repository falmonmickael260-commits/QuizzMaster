// Primitives de dessin 2D pour les écrans intégrés au décor (textures de canvas).

export const FONTS = {
  display: "Anton, Impact, 'Arial Narrow Bold', sans-serif",
  text: "Outfit, 'Segoe UI', Roboto, Arial, sans-serif",
};

export let fontsVersion = 0;

export function setFonts(display: string, text: string) {
  FONTS.display = `${display}, Impact, sans-serif`;
  FONTS.text = `${text}, 'Segoe UI', Roboto, Arial, sans-serif`;
  fontsVersion++;
}

export function markFontsLoaded() {
  fontsVersion++;
}

export const C = {
  bg0: "#04050c",
  bg1: "#0a0f2c",
  bg2: "#141b4a",
  cyan: "#29e7ff",
  coral: "#ff2e63",
  amber: "#ffb800",
  green: "#2ee59d",
  red: "#ff3b5c",
  orange: "#ff9f1c",
  white: "#ffffff",
  dim: "#8a93c7",
};

export type Ctx = CanvasRenderingContext2D;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function font(ctx: Ctx, size: number, kind: "display" | "text" = "text", weight = 700) {
  ctx.font = kind === "display" ? `${size}px ${FONTS.display}` : `${weight} ${size}px ${FONTS.text}`;
}

/** Découpe un texte en lignes tenant dans maxWidth. */
export function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Texte multi-ligne auto-dimensionné dans une boîte. Retourne la taille de police utilisée. */
export function fitText(
  ctx: Ctx,
  text: string,
  box: { x: number; y: number; w: number; h: number },
  opts: { max: number; min: number; kind?: "display" | "text"; weight?: number; color?: string; align?: CanvasTextAlign; lineHeight?: number; valign?: "middle" | "top" },
) {
  let size = opts.max;
  let lines: string[] = [];
  const lh = opts.lineHeight ?? 1.15;
  for (; size >= opts.min; size -= 2) {
    font(ctx, size, opts.kind, opts.weight);
    lines = wrap(ctx, text, box.w);
    const tooWide = lines.some((l) => ctx.measureText(l).width > box.w);
    if (lines.length * size * lh <= box.h && !tooWide) break;
  }
  ctx.fillStyle = opts.color ?? C.white;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = "middle";
  const total = lines.length * size * lh;
  let y = opts.valign === "top" ? box.y + (size * lh) / 2 : box.y + box.h / 2 - total / 2 + (size * lh) / 2;
  const x = opts.align === "left" ? box.x : opts.align === "right" ? box.x + box.w : box.x + box.w / 2;
  for (const l of lines) {
    ctx.fillText(l, x, y);
    y += size * lh;
  }
  return size;
}

/** Une ligne de texte réduite si besoin pour tenir dans maxWidth. */
export function fitLine(ctx: Ctx, text: string, x: number, y: number, maxWidth: number, size: number, kind: "display" | "text" = "text", weight = 800) {
  let s = size;
  font(ctx, s, kind, weight);
  while (ctx.measureText(text).width > maxWidth && s > 8) {
    s -= 2;
    font(ctx, s, kind, weight);
  }
  ctx.fillText(text, x, y);
}

export function glow(ctx: Ctx, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

export function noGlow(ctx: Ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

export function screenBackground(ctx: Ctx, w: number, h: number, tint = C.bg2, t = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // halo central
  const rg = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, Math.max(w, h) * 0.7);
  rg.addColorStop(0, tint + "cc");
  rg.addColorStop(1, "#00000000");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  // lignes diagonales animées (signature visuelle BLIND QUIZZ)
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = Math.max(2, w / 500);
  const step = w / 14;
  const off = ((t / 60) % step) - step;
  for (let x = off - h; x < w + h; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + h * 0.6, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** Logo QUIZZ MASTER : « QUIZZ » en blanc, « MASTER » en or. */
export function drawLogo(ctx: Ctx, cx: number, cy: number, size: number, _t = 0) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  font(ctx, size, "display");
  const aW = ctx.measureText("QUIZZ").width;
  const bW = ctx.measureText("MASTER").width;
  const gap = size * 0.2;
  const x0 = cx - (aW + gap + bW) / 2;
  glow(ctx, "#5aa8ff", size * 0.3);
  ctx.fillStyle = C.white;
  ctx.fillText("QUIZZ", x0 + aW / 2, cy);
  const g = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
  g.addColorStop(0, "#fff1b0");
  g.addColorStop(0.5, "#ffc94a");
  g.addColorStop(1, "#d98e1c");
  glow(ctx, "#ffb52e", size * 0.3);
  ctx.fillStyle = g;
  ctx.fillText("MASTER", x0 + aW + gap + bW / 2, cy);
  ctx.restore();
}

export function pill(ctx: Ctx, text: string, cx: number, cy: number, size: number, bg: string, fg = C.white, border?: string) {
  font(ctx, size, "text", 800);
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 1.7;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  if (border) {
    ctx.lineWidth = Math.max(2, size / 10);
    ctx.strokeStyle = border;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + size * 0.04);
  return w;
}

/** Anneau de chrono. ratio = temps restant / total. */
export function timerRing(ctx: Ctx, cx: number, cy: number, r: number, ratio: number, label: string, urgent: boolean) {
  const color = urgent ? C.red : ratio < 0.5 ? C.amber : C.cyan;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = "#ffffff22";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  glow(ctx, color, r * 0.4);
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, ratio)));
  ctx.stroke();
  noGlow(ctx);
  ctx.fillStyle = "#050818";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = urgent ? C.red : C.white;
  font(ctx, r * 1.05, "display");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + r * 0.05);
  ctx.restore();
}

export function formatScore(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ─── Animation des scores ────────────────────────────────────────────────────

const tweens = new Map<string, { from: number; to: number; start: number }>();

/** Valeur affichée d'un score qui « roule » vers sa nouvelle valeur (1,2 s). */
export function tweenScore(key: string, target: number, now: number, duration = 1200): number {
  let tw = tweens.get(key);
  if (!tw) {
    tw = { from: target, to: target, start: now };
    tweens.set(key, tw);
  }
  if (tw.to !== target) {
    const current = tweenValue(tw, now, duration);
    tw.from = current;
    tw.to = target;
    tw.start = now;
  }
  return tweenValue(tw, now, duration);
}

function tweenValue(tw: { from: number; to: number; start: number }, now: number, duration: number) {
  const p = Math.min(1, Math.max(0, (now - tw.start) / duration));
  const e = 1 - Math.pow(1 - p, 3);
  return tw.from + (tw.to - tw.from) * e;
}

export function isTweening(key: string, now: number, duration = 1200) {
  const tw = tweens.get(key);
  return !!tw && tw.from !== tw.to && now - tw.start < duration;
}
