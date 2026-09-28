import { REVEAL_LOCK_MS } from "@shared/config";
import * as THREE from "three";
import type { Mood } from "@/components/stage/Character";
import type { PublicPlayer, PublicRoomState } from "@shared/types";
import { WHEEL_SEGMENTS } from "@shared/wheel";
import { HOST_POS, SCREEN_POS, WHEEL_CENTER_Y, WHEEL_POS, seatHead, seatScreen } from "./layout";

const BIG_SCREEN_LOOK = SCREEN_POS.clone();
const HOST_LOOK = HOST_POS.clone().setY(2.3);
const WHEEL_LOOK = WHEEL_POS.clone().setY(WHEEL_CENTER_Y);
const CAMERA_LOOK = new THREE.Vector3(0, 3.5, 16);

/** Émotion et regard d'un candidat, déduits de l'état public de la partie. */
export function candidateMood(p: PublicPlayer, s: PublicRoomState, now: number): { mood: Mood; look: THREE.Vector3 } {
  const t = now - s.phaseStartedAt;
  const SCREEN_LOOK = seatScreen(p.seat); // son propre écran de pupitre
  switch (s.phase) {
    case "lobby": {
      const joined = s.events.find((e) => e.type === "join" && e.playerId === p.id);
      if (joined && now - joined.at < 2500) return { mood: "wave", look: CAMERA_LOOK };
      return { mood: "idle", look: HOST_LOOK };
    }
    case "intro":
      return { mood: t < 2500 ? "clap" : "idle", look: t < 2500 ? CAMERA_LOOK : HOST_LOOK };
    case "round_intro":
      return { mood: p.modifiers.pointsMultiplier === 2 ? "excited" : "idle", look: HOST_LOOK };
    case "question": {
      if (!s.question?.text) return { mood: "focused", look: HOST_LOOK };
      if (p.answered) return { mood: p.mode === "solo" ? "confident" : "idle", look: HOST_LOOK };
      if (p.mode) return { mood: "focused", look: SCREEN_LOOK };
      return { mood: "thinking", look: SCREEN_LOOK };
    }
    case "reveal": {
      const r = s.reveal?.results[p.id];
      if (!r) return { mood: "idle", look: HOST_LOOK };
      if (t < REVEAL_LOCK_MS + 300) return { mood: "focused", look: BIG_SCREEN_LOOK };
      const tr = t - REVEAL_LOCK_MS;
      if (r.correct) return { mood: r.mode === "solo" ? "ecstatic" : "happy", look: tr < 3500 ? CAMERA_LOOK : HOST_LOOK };
      if (r.timedOut) return { mood: "shrug", look: CAMERA_LOOK };
      return { mood: tr < 2500 ? "shocked" : "sad", look: SCREEN_LOOK };
    }
    case "leaderboard": {
      const rank = s.ranking.find((r) => r.playerId === p.id);
      if (rank?.rank === 1 && t > 2500) return { mood: "happy", look: CAMERA_LOOK };
      return { mood: t > 2500 ? "clap" : "idle", look: HOST_LOOK };
    }
    case "wheel": {
      const w = s.wheel;
      if (!w) return { mood: "idle", look: WHEEL_LOOK };
      const isSpinner = w.spinnerId === p.id;
      if (w.stage === "result" && w.outcome) {
        const seg = WHEEL_SEGMENTS.find((x) => x.id === w.outcome!.segmentId);
        const delta = w.outcome.scoreChanges[p.id] ?? 0;
        if (w.outcome.affectedIds.includes(p.id)) {
          if (w.outcome.blockedByShield) return { mood: "happy", look: CAMERA_LOOK };
          if (delta < 0 || (seg && (seg.tone === "malus" || seg.tone === "steal") && !isSpinner)) return { mood: "shocked", look: CAMERA_LOOK };
          return { mood: "ecstatic", look: CAMERA_LOOK };
        }
        return { mood: isSpinner ? "happy" : "idle", look: w.targetId ? seatHead(s.players.find((x) => x.id === w.targetId)?.seat ?? 0) : WHEEL_LOOK };
      }
      if (w.stage === "choose_target") return { mood: isSpinner ? "thinking" : "focused", look: isSpinner ? CAMERA_LOOK : WHEEL_LOOK };
      if (isSpinner) return { mood: "excited", look: WHEEL_LOOK };
      return { mood: w.stage === "spinning" ? "focused" : "idle", look: WHEEL_LOOK };
    }
    case "final": {
      const rank = s.ranking.find((r) => r.playerId === p.id)?.rank ?? 99;
      if (t < 2500) return { mood: "focused", look: HOST_LOOK };
      if (rank === 1) return { mood: "victory", look: CAMERA_LOOK };
      return { mood: rank <= 3 ? "happy" : "clap", look: t % 8000 < 4000 ? CAMERA_LOOK : HOST_LOOK };
    }
  }
  return { mood: "idle", look: HOST_LOOK };
}

/** Attitude de l'animateur selon la phase. */
export function hostMood(s: PublicRoomState | null, now: number): { mood: Mood; look: THREE.Vector3 } {
  if (!s) return { mood: "idle", look: CAMERA_LOOK };
  const t = now - s.phaseStartedAt;
  switch (s.phase) {
    case "lobby":
      return { mood: Math.floor(now / 6000) % 3 === 0 ? "present" : "idle", look: CAMERA_LOOK };
    case "intro":
      return { mood: t < 3000 ? "present" : "talk", look: CAMERA_LOOK };
    case "round_intro":
      return { mood: "talk", look: CAMERA_LOOK };
    case "question":
      if (!s.question?.text) return { mood: "talk", look: CAMERA_LOOK };
      return { mood: t < s.question.startsAt - s.phaseStartedAt + 1500 ? "point" : "idle", look: BIG_SCREEN_LOOK };
    case "reveal":
      return { mood: t < REVEAL_LOCK_MS + 2000 ? "point" : "talk", look: t < REVEAL_LOCK_MS + 2000 ? BIG_SCREEN_LOOK : CAMERA_LOOK };
    case "leaderboard":
      return { mood: "present", look: CAMERA_LOOK };
    case "wheel":
      return { mood: s.wheel?.stage === "spinning" ? "excited" : "point", look: WHEEL_LOOK };
    case "final":
      return { mood: t < 3000 ? "talk" : "clap", look: CAMERA_LOOK };
  }
  return { mood: "idle", look: CAMERA_LOOK };
}
