"use client";

// Habillage sonore 100 % synthétisé (Web Audio) : aucun fichier à charger, aucun droit à gérer.

type MusicMode = "none" | "intro" | "think" | "lobby" | "suspense" | "final";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicMode: MusicMode = "none";
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  muted = false;

  /** Doit être appelé suite à un geste utilisateur (politique d'autoplay des navigateurs). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slide?: number; out?: GainNode | null; attack?: number } = {}) {
    if (!this.ctx) return;
    const t = opts.at ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(opts.out ?? this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, opts: { gain?: number; at?: number; filter?: number; out?: GainNode | null } = {}) {
    if (!this.ctx) return;
    const t = opts.at ?? this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = opts.filter ?? 2000;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 0.2;
    src.connect(f).connect(g).connect(opts.out ?? this.sfxGain!);
    src.start(t);
  }

  // ─── Effets ────────────────────────────────────────────────────────────────

  /** Tic-tac du chrono : intensity de 0 (12 s restantes) à 1 (dernière seconde). */
  tick(urgent = false, intensity = 1) {
    this.tone(urgent ? 1400 : 900 + intensity * 300, 0.05, { type: "square", gain: urgent ? 0.13 : 0.025 + intensity * 0.05 });
    if (urgent) {
      // battement de cœur sous les 3 dernières secondes
      const t = this.ctx?.currentTime ?? 0;
      this.tone(70, 0.12, { type: "sine", gain: 0.35, at: t });
      this.tone(62, 0.14, { type: "sine", gain: 0.3, at: t + 0.16 });
    }
  }
  select() {
    this.tone(660, 0.08, { type: "triangle", gain: 0.25 });
    this.tone(990, 0.12, { type: "triangle", gain: 0.2, at: (this.ctx?.currentTime ?? 0) + 0.06 });
  }
  modePick(mode: "4" | "2" | "solo") {
    const base = mode === "4" ? 392 : mode === "2" ? 523 : 659;
    const t = this.ctx?.currentTime ?? 0;
    [1, 1.25, 1.5, mode === "solo" ? 2 : 1.5].forEach((m, i) => this.tone(base * m, 0.18, { type: "sawtooth", gain: 0.09, at: t + i * 0.05 }));
  }
  lock() {
    this.tone(220, 0.15, { type: "square", gain: 0.12 });
    this.noise(0.08, { gain: 0.15, filter: 3000 });
  }
  correct(big = false) {
    const t = this.ctx?.currentTime ?? 0;
    const notes = big ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.35, { type: "triangle", gain: 0.25, at: t + i * 0.08 }));
  }
  wrong() {
    const t = this.ctx?.currentTime ?? 0;
    this.tone(311, 0.3, { type: "sawtooth", gain: 0.12, at: t, slide: 0.8 });
    this.tone(233, 0.45, { type: "sawtooth", gain: 0.12, at: t + 0.22, slide: 0.7 });
  }
  points() {
    const t = this.ctx?.currentTime ?? 0;
    for (let i = 0; i < 6; i++) this.tone(1200 + i * 120, 0.06, { type: "square", gain: 0.05, at: t + i * 0.045 });
  }
  whoosh() {
    this.noise(0.5, { gain: 0.25, filter: 900 });
  }
  wheelClick() {
    this.tone(1800, 0.025, { type: "square", gain: 0.1 });
  }
  bonus() {
    const t = this.ctx?.currentTime ?? 0;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.2, { type: "square", gain: 0.1, at: t + i * 0.07 }));
  }
  malus() {
    const t = this.ctx?.currentTime ?? 0;
    this.tone(180, 0.6, { type: "sawtooth", gain: 0.18, at: t, slide: 0.5 });
    this.noise(0.4, { gain: 0.2, filter: 400, at: t });
  }
  drumroll(dur = 2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < dur * 22; i++) this.noise(0.05, { gain: 0.05 + (i / (dur * 22)) * 0.1, filter: 500, at: t + i / 22 });
  }
  fanfare() {
    const t = this.ctx?.currentTime ?? 0;
    const seq = [523, 523, 523, 698, 880, 784, 1047];
    const dur = [0.12, 0.12, 0.12, 0.35, 0.25, 0.25, 0.8];
    let at = t;
    seq.forEach((f, i) => {
      this.tone(f, dur[i] + 0.1, { type: "sawtooth", gain: 0.12, at });
      this.tone(f / 2, dur[i] + 0.1, { type: "triangle", gain: 0.12, at });
      at += dur[i];
    });
  }
  applause(dur = 2.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < dur * 30; i++) this.noise(0.04, { gain: 0.03 + Math.random() * 0.05, filter: 1500 + Math.random() * 2500, at: t + i / 30 + Math.random() * 0.02 });
  }

  // ─── Ambiance plateau (rumeur du public) ──────────────────────────────────

  private crowd: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Rumeur continue du public ; level 0 = silence, 1 = plateau animé. */
  ambience(level: number) {
    if (!this.ctx || !this.master) return;
    if (!this.crowd) {
      const len = this.ctx.sampleRate * 3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // bruit brun modulé : ressemble à un murmure lointain
        last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
        d[i] = last * 3.5 * (0.7 + 0.3 * Math.sin((i / len) * Math.PI * 14));
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 520;
      f.Q.value = 0.6;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(f).connect(gain).connect(this.master);
      src.start();
      this.crowd = { src, gain };
    }
    this.crowd.gain.gain.setTargetAtTime(0.18 * level, this.ctx.currentTime, 0.6);
  }

  // ─── Musique ───────────────────────────────────────────────────────────────

  music(mode: MusicMode) {
    if (mode === this.musicMode) return;
    this.musicMode = mode;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (!this.ctx || mode === "none") return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    const bpm = mode === "think" ? 128 : mode === "suspense" ? 100 : mode === "final" ? 118 : 112;
    const stepDur = 60 / bpm / 2; // croches
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.2) {
        this.playStep(mode, this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    }, 50);
  }

  private playStep(mode: MusicMode, step: number, at: number, dur: number) {
    const out = this.musicGain;
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    // Progression : Am - F - C - G (lobby / intro / final), tension sur Am - E (réflexion)
    const roots = mode === "think" || mode === "suspense" ? [110, 110, 82.4, 82.4] : [110, 87.3, 130.8, 98];
    const root = roots[bar];
    if (mode === "think") {
      if (s % 2 === 0) this.tone(root, dur * 0.9, { type: "triangle", gain: 0.35, at, out });
      if (s === 0 || s === 4) this.noise(0.05, { gain: 0.25, filter: 120, at, out });
      if (s % 2 === 1) this.noise(0.03, { gain: 0.08, filter: 8000, at, out });
      if (s === 3 || s === 7) this.tone(root * 4 * (s === 7 ? 1.19 : 1), dur * 0.5, { type: "square", gain: 0.05, at, out });
      return;
    }
    if (mode === "suspense") {
      if (s === 0) this.tone(root / 2, dur * 7, { type: "sawtooth", gain: 0.12, at, out, attack: 0.5 });
      if (s % 2 === 0) this.noise(0.04, { gain: 0.07, filter: 300, at, out });
      return;
    }
    // intro / lobby / final : groove pop
    if (s === 0 || s === 4) this.noise(0.08, { gain: 0.3, filter: 110, at, out });
    if (s === 2 || s === 6) this.noise(0.1, { gain: 0.12, filter: 2500, at, out });
    this.noise(0.02, { gain: 0.04, filter: 9000, at, out });
    if (s % 2 === 0) this.tone(root, dur * 0.8, { type: "triangle", gain: 0.3, at, out });
    const arp = [1, 1.5, 2, 2.52, 3, 2.52, 2, 1.5];
    const lead = mode === "final" ? 4 : 2;
    this.tone(root * lead * arp[s], dur * 0.7, { type: mode === "final" ? "sawtooth" : "square", gain: mode === "lobby" ? 0.035 : 0.05, at, out });
  }
}

export const audio = new AudioEngine();
