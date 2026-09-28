import type { WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../../shared/types";
import { GameError, Room, type QuestionSource, type RoomTimings } from "./room";
import { TIMINGS } from "../../shared/config";

interface Conn {
  ws: WebSocket;
  roomCode: string | null;
  playerId: string | null;
}

/** Gestion des rooms et du transport temps réel (WebSocket) — le serveur est la source de vérité. */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private conns = new Set<Conn>();
  private sweepTimer: ReturnType<typeof setInterval>;

  constructor(private source: QuestionSource, private timings: RoomTimings = TIMINGS) {
    this.sweepTimer = setInterval(() => this.sweep(), 10_000);
    this.sweepTimer.unref?.();
  }

  get roomCount() {
    return this.rooms.size;
  }

  private newCode(): string {
    for (;;) {
      const code = `BQ-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!this.rooms.has(code)) return code;
    }
  }

  private createRoom(): Room {
    const room = new Room(this.newCode(), this.source, this.timings);
    room.onState = (state) => {
      const msg = JSON.stringify({ t: "state", state } satisfies ServerMessage);
      for (const c of this.conns) if (c.roomCode === room.code && c.ws.readyState === 1) c.ws.send(msg);
    };
    room.onPrivate = (playerId, priv) => {
      const msg = JSON.stringify({ t: "private", private: priv, serverNow: Date.now() } satisfies ServerMessage);
      for (const c of this.conns) if (c.roomCode === room.code && c.playerId === playerId && c.ws.readyState === 1) c.ws.send(msg);
    };
    this.rooms.set(room.code, room);
    return room;
  }

  attach(ws: WebSocket) {
    const conn: Conn = { ws, roomCode: null, playerId: null };
    this.conns.add(conn);
    let alive = true;
    const hb = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 20_000);
    ws.on("pong", () => (alive = true));
    ws.on("message", (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      this.onMessage(conn, msg).catch((e) => this.sendError(conn, e));
    });
    ws.on("close", () => {
      clearInterval(hb);
      this.conns.delete(conn);
      if (conn.roomCode && conn.playerId) {
        const room = this.rooms.get(conn.roomCode);
        // Un même joueur peut avoir plusieurs onglets : on ne le marque absent que s'il n'en reste aucun.
        const stillThere = [...this.conns].some((c) => c.roomCode === conn.roomCode && c.playerId === conn.playerId);
        if (room && !stillThere) room.setConnected(conn.playerId, false);
      }
    });
  }

  private send(conn: Conn, msg: ServerMessage) {
    if (conn.ws.readyState === 1) conn.ws.send(JSON.stringify(msg));
  }

  private sendError(conn: Conn, e: unknown) {
    const err = e instanceof GameError ? e : null;
    if (!err) console.error("[ws]", e);
    this.send(conn, { t: "error", message: err ? err.message : "Erreur serveur", code: err?.code });
  }

  private welcome(conn: Conn, room: Room, playerId: string, token: string) {
    conn.roomCode = room.code;
    conn.playerId = playerId;
    this.send(conn, { t: "welcome", playerId, token, state: room.publicState(), private: room.privateState(playerId) });
  }

  private async onMessage(conn: Conn, msg: ClientMessage) {
    switch (msg.t) {
      case "ping":
        return this.send(conn, { t: "pong", clientTime: msg.clientTime, serverNow: Date.now() });
      case "create": {
        this.detach(conn);
        const room = this.createRoom();
        const p = room.addPlayer(msg.name, msg.character);
        if (msg.rounds) room.handle(p.id, { t: "settings", rounds: msg.rounds });
        return this.welcome(conn, room, p.id, p.token);
      }
      case "join": {
        const code = normalizeCode(msg.code);
        const room = this.rooms.get(code);
        if (!room) throw new GameError(`Aucune partie ne porte le code ${code}.`, "no_room");
        this.detach(conn);
        const p = room.addPlayer(msg.name, msg.character);
        return this.welcome(conn, room, p.id, p.token);
      }
      case "resume": {
        const room = this.rooms.get(normalizeCode(msg.code));
        if (!room) throw new GameError("Cette partie n'existe plus.", "no_room");
        this.detach(conn);
        const p = room.resume(msg.token);
        return this.welcome(conn, room, p.id, p.token);
      }
      default: {
        if (!conn.roomCode || !conn.playerId) throw new GameError("Rejoins d'abord une partie.");
        const room = this.rooms.get(conn.roomCode);
        if (!room) throw new GameError("Cette partie n'existe plus.", "no_room");
        await room.handle(conn.playerId, msg);
        if (msg.t === "leave") {
          conn.roomCode = null;
          conn.playerId = null;
        }
      }
    }
  }

  private detach(conn: Conn) {
    if (conn.roomCode && conn.playerId) {
      const room = this.rooms.get(conn.roomCode);
      const pid = conn.playerId;
      conn.roomCode = null;
      conn.playerId = null;
      const stillThere = [...this.conns].some((c) => c.roomCode === room?.code && c.playerId === pid);
      if (room && !stillThere) room.setConnected(pid, false);
    }
  }

  private sweep() {
    for (const [code, room] of this.rooms) {
      if (room.sweep()) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }

  dispose() {
    clearInterval(this.sweepTimer);
    for (const r of this.rooms.values()) r.dispose();
  }
}

export function normalizeCode(code: string): string {
  const digits = (code ?? "").toString().toUpperCase().replace(/[^0-9]/g, "").slice(0, 4);
  return `BQ-${digits}`;
}
