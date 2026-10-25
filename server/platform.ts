/**
 * Déclare le résultat d'une partie terminée au projet Supabase central de
 * Revanche Game (comptes, profils, statistiques). Optionnel : sans ces
 * variables d'environnement, Quiz Master fonctionne exactement comme avant.
 * Voir docs/PLATFORM.md (dépôt revanche-games-web) pour le contrat complet.
 *
 * Lues à l'intérieur des fonctions, jamais au chargement du module :
 * `loadEnvConfig` (server/index.ts) ne charge .env.local qu'au début de
 * `main()`, après que tous les imports — donc ce module — ont déjà fini de
 * s'évaluer. Une constante top-level verrait toujours ces variables absentes.
 */

function platformConfig() {
  const url = process.env.PLATFORM_SUPABASE_URL;
  const key = process.env.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function isPlatformReportingEnabled(): boolean {
  return platformConfig() !== null;
}

export interface PlatformPlayer {
  user_id: string | null;
  guest_label: string | null;
  outcome: "win" | "loss" | "draw";
  score: number | null;
  position: number | null;
}

export function reportMatchResult(params: {
  roomCode: string;
  finishedAt: number;
  players: PlatformPlayer[];
}): void {
  const config = platformConfig();
  if (!config) return;

  void (async () => {
    try {
      const response = await fetch(`${config.url}/rest/v1/rpc/record_game_result`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_game_slug: "quiz-master",
          p_idempotency_key: `quiz-master:${params.roomCode}:${params.finishedAt}`,
          p_room_code: params.roomCode,
          p_raw_payload: null,
          p_players: params.players,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("[platform] record_game_result failed", response.status, body);
      }
    } catch (error) {
      // Une panne de la plateforme centrale ne doit jamais interrompre une partie en cours.
      console.error("[platform] record_game_result error", error);
    }
  })();
}
