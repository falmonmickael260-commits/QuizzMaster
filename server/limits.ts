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

/**
 * En-têtes de sécurité ajoutés à toutes les réponses HTTP.
 *
 * `PLATFORM_SHELL_ORIGIN` autorise explicitement la coquille Revanche Game à
 * afficher ce jeu dans une iframe (ex. "http://localhost:3001" en
 * développement, l'adresse réelle de la plateforme en production) — sans
 * cette variable, le comportement par défaut (aucun cadrage externe) est
 * inchangé. Les navigateurs modernes appliquent `frame-ancestors` (CSP) et
 * ignorent `X-Frame-Options` dès que l'un des deux autorise le cadrage ;
 * on retire donc `X-Frame-Options` plutôt que de le contredire.
 */
// Fonction, pas une constante : `.env.local` n'est chargé par `loadEnvConfig`
// qu'au tout début de `main()`, après que ce module a déjà fini de
// s'évaluer — lire `process.env` ici au chargement verrait toujours la
// variable absente. En la lisant à chaque appel (une par requête), on a la
// bonne valeur une fois l'environnement réellement chargé.
export function securityHeaders(): Record<string, string> {
  const shellOrigin = process.env.PLATFORM_SHELL_ORIGIN;
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...(shellOrigin ? {} : { "X-Frame-Options": "SAMEORIGIN" }),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": `frame-ancestors 'self'${shellOrigin ? ` ${shellOrigin}` : ""}; base-uri 'self'; object-src 'none'; form-action 'self'`,
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}
