"use client";

import { create } from "zustand";
import type { AnswerMode } from "@shared/config";
import type { ClientMessage, PrivateState, PublicRoomState, ServerMessage } from "@shared/types";

const SESSION_KEY = "bq-session";

interface Session {
  code: string;
  token: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "success";
}

interface GameStore {
  status: "idle" | "connecting" | "open" | "closed";
  state: PublicRoomState | null;
  priv: PrivateState | null;
  playerId: string | null;
  clockOffset: number;
  toasts: Toast[];
  connect: () => void;
  send: (msg: ClientMessage) => void;
  create: (name: string, character: string, rounds: number) => void;
  join: (code: string, name: string, character: string) => void;
  start: () => void;
  setRounds: (rounds: number) => void;
  chooseMode: (mode: AnswerMode) => void;
  answer: (value: string) => void;
  spin: () => void;
  target: (playerId: string) => void;
  restart: () => void;
  leave: () => void;
  addBots: (count?: number) => void;
  removeBots: () => void;
  setAutopilot: (on: boolean) => void;
  /** Partie de démonstration : crée la room, ajoute 3 candidats simulés, active le pilote automatique et lance. */
  startDemo: (name: string, character: string, rounds: number) => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let toastSeq = 0;
let pending: ClientMessage[] = [];
/** Messages à envoyer dès que la room est créée (partie de démonstration). */
let afterWelcome: ClientMessage[] = [];

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* stockage indisponible : pas de reprise de session */
  }
}

export const useGame = create<GameStore>((set, get) => ({
  status: "idle",
  state: null,
  priv: null,
  playerId: null,
  clockOffset: 0,
  toasts: [],

  connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    set({ status: "connecting" });
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = process.env.NEXT_PUBLIC_GAME_WS_URL || `${proto}://${location.host}/ws`;
    const sock = new WebSocket(url);
    ws = sock;
    sock.onopen = () => {
      set({ status: "open" });
      const session = loadSession();
      // Reprise automatique après un rechargement ou une coupure réseau.
      if (session) sock.send(JSON.stringify({ t: "resume", code: session.code, token: session.token } satisfies ClientMessage));
      for (const m of pending) sock.send(JSON.stringify(m));
      pending = [];
      const ping = () => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify({ t: "ping", clientTime: Date.now() }));
      ping();
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(ping, 10_000);
    };
    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage;
      switch (msg.t) {
        case "welcome":
          saveSession({ code: msg.state.code, token: msg.token });
          set({ playerId: msg.playerId, state: msg.state, priv: msg.private });
          syncUrl(msg.state.code);
          if (afterWelcome.length) {
            const queued = afterWelcome;
            afterWelcome = [];
            queued.forEach((m) => get().send(m));
          }
          break;
        case "state":
          set({ state: msg.state });
          break;
        case "private":
          set({ priv: msg.private });
          break;
        case "pong": {
          // Estimation du décalage d'horloge client/serveur (le serveur fait foi pour les chronos).
          const now = Date.now();
          const rtt = now - msg.clientTime;
          const offset = msg.serverNow + rtt / 2 - now;
          const prev = get().clockOffset;
          set({ clockOffset: prev === 0 ? offset : prev * 0.7 + offset * 0.3 });
          break;
        }
        case "error":
          if (msg.code === "unknown_token" || msg.code === "no_room") {
            saveSession(null);
            if (get().state && msg.code === "no_room") set({ state: null, priv: null, playerId: null });
            if (!get().state) syncUrl(null);
          }
          if (msg.code !== "unknown_token") get().toast(msg.message, "error");
          break;
      }
    };
    sock.onclose = () => {
      set({ status: "closed" });
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => get().connect(), 1500);
    };
  },

  send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else {
      pending.push(msg);
      get().connect();
    }
  },

  create(name, character, rounds) {
    saveSession(null);
    get().send({ t: "create", name, character, rounds });
  },
  join(code, name, character) {
    saveSession(null);
    get().send({ t: "join", code, name, character });
  },
  start: () => get().send({ t: "start" }),
  setRounds: (rounds) => get().send({ t: "settings", rounds }),
  chooseMode: (mode) => get().send({ t: "mode", mode }),
  answer: (value) => get().send({ t: "answer", value }),
  spin: () => get().send({ t: "spin" }),
  target: (playerId) => get().send({ t: "target", playerId }),
  restart: () => get().send({ t: "restart" }),
  addBots: (count = 3) => get().send({ t: "addBots", count }),
  removeBots: () => get().send({ t: "removeBots" }),
  setAutopilot: (on) => get().send({ t: "autopilot", on }),
  startDemo(name, character, rounds) {
    saveSession(null);
    afterWelcome = [{ t: "addBots", count: 3 }, { t: "autopilot", on: true }, { t: "start" }];
    get().send({ t: "create", name, character, rounds });
  },
  leave() {
    get().send({ t: "leave" });
    saveSession(null);
    syncUrl(null);
    set({ state: null, priv: null, playerId: null });
  },
  toast(text, tone = "info") {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
  },
}));

// Accès au store pour les tests automatisés (l'état exposé est déjà public).
if (typeof window !== "undefined") (window as unknown as { __BQ: typeof useGame }).__BQ = useGame;

/** Heure serveur estimée (ms). */
export function serverNow(): number {
  return Date.now() + useGame.getState().clockOffset;
}

function syncUrl(code: string | null) {
  try {
    const url = new URL(location.href);
    url.searchParams.delete("partie-test");
    if (code) url.searchParams.set("room", code);
    else url.searchParams.delete("room");
    history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}

export function useMe() {
  const state = useGame((s) => s.state);
  const playerId = useGame((s) => s.playerId);
  return state?.players.find((p) => p.id === playerId) ?? null;
}
