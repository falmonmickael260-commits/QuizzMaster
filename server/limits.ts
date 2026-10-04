// Protections contre les abus : limites de débit (seau à jetons), plafonds par adresse IP.
import type { IncomingMessage } from "node:http";

/** Seau à jetons : `burst` actions d'un coup, puis `perSecond` actions par seconde. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private burst: number, private perSecond: number) {
    this.tokens = burst;
  }
  take(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

/** Compteur d'événements par clé sur une fenêtre glissante (ex. échecs de mot de passe par IP). */
export class WindowCounter {
  private hits = new Map<string, number[]>();
  constructor(private windowMs: number, private max: number) {}
  private prune(key: string, now: number) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }
  blocked(key: string): boolean {
    return this.prune(key, Date.now()).length >= this.max;
  }
  hit(key: string) {
    const now = Date.now();
    const list = this.prune(key, now);
    list.push(now);
    this.hits.set(key, list);
    // garde-fou mémoire
    if (this.hits.size > 10_000) this.hits.clear();
  }
}

/** Adresse du client ; derrière le proxy de l'hébergeur, la première adresse de X-Forwarded-For. */
export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "?";
}

/** En-têtes de sécurité ajoutés à toutes les réponses HTTP. */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
};
