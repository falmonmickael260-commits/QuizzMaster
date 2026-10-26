"use client";

/**
 * Code de salle reçu en paramètre d'URL `rg_room`, quand la coquille Revanche
 * Games ouvre ce jeu à la suite d'une invitation acceptée.
 *
 * Même principe que `rg_token` (voir platformToken.ts) : lu une fois à
 * l'ouverture, mis en cache en `sessionStorage`, puis retiré de l'URL
 * visible. Le cache couvre un rechargement avant d'avoir rejoint ; il est
 * consommé dès qu'on entre dans une partie, pour qu'une invitation ancienne
 * ne ramène pas le joueur dans une partie déjà finie.
 *
 * Aucune confiance accordée à cette valeur : c'est le serveur du jeu qui dira
 * si la salle existe encore et si elle accepte un joueur de plus.
 */

const STORAGE_KEY = "rg_room";
let cached: string | null | undefined;

/** Un code QUIZZ MASTER est strictement 4 chiffres (voir `onJoin` dans Home.tsx). */
function normalize(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, 4);
}

export function getIncomingRoomCode(): string | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("rg_room");

  if (fromUrl) {
    const code = normalize(fromUrl);
    // Le paramètre est retiré même s'il est illisible : il n'a rien à faire
    // dans la barre d'adresse, ni dans un lien partagé ensuite.
    params.delete("rg_room");
    const clean = window.location.pathname + (params.size ? `?${params}` : "");
    window.history.replaceState({}, "", clean);

    if (code.length === 4) {
      try {
        sessionStorage.setItem(STORAGE_KEY, code);
      } catch {
        /* navigation privée — valeur gardée en mémoire */
      }
      cached = code;
      return cached;
    }

    cached = null;
    return null;
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    cached = stored && stored.length === 4 ? stored : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Oublie l'invitation, une fois le joueur entré dans une partie. */
export function clearIncomingRoomCode(): void {
  cached = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* rien à nettoyer */
  }
}
