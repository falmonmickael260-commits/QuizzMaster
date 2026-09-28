// Met le serveur de jeu BLIND QUIZZ en ligne sur Railway, depuis votre ordinateur.
//
//   npm run deploy:railway
//
// 1. Connexion à Railway : le navigateur s'ouvre, c'est vous qui vous connectez.
// 2. Création (la première fois) du projet et du service « blind-quizz ».
// 3. Envoi des variables lues dans .env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD).
//    Les valeurs passent par l'entrée standard : elles n'apparaissent ni à l'écran ni dans l'historique.
// 4. Envoi du code et déploiement, puis création de l'adresse publique.
//
// Relancer le script plus tard redéploie simplement la version actuelle du code.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline/promises";

const SERVICE = "blind-quizz";
const CLI = ["-y", "@railway/cli@latest"];
const win = process.platform === "win32";

function railway(args, { input, quiet } = {}) {
  const r = spawnSync(win ? "npx.cmd" : "npx", [...CLI, ...args], {
    stdio: input !== undefined ? ["pipe", quiet ? "pipe" : "inherit", "inherit"] : quiet ? ["inherit", "pipe", "pipe"] : "inherit",
    input,
    encoding: "utf8",
    shell: win,
  });
  return { ok: r.status === 0, out: r.stdout ?? "" };
}

function step(n, text) {
  console.log(`\n\x1b[1m[${n}/5] ${text}\x1b[0m`);
}

function fail(text) {
  console.error(`\n\x1b[31m✖ ${text}\x1b[0m`);
  process.exit(1);
}

function readEnvLocal() {
  const env = {};
  if (!fs.existsSync(".env.local")) return env;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

if (!fs.existsSync("package.json") || !fs.existsSync("railway.json")) fail("Lancez ce script depuis le dossier du projet QuizzMaster.");

// 1. Connexion
step(1, "Connexion à Railway");
if (railway(["whoami"], { quiet: true }).ok) {
  console.log("Déjà connecté.");
} else {
  console.log("Votre navigateur va s'ouvrir : connectez-vous à Railway (avec GitHub par exemple), puis revenez ici.");
  if (!railway(["login"]).ok) fail("Connexion à Railway annulée ou impossible.");
}

// 2. Projet + service
step(2, "Projet Railway");
if (railway(["status"], { quiet: true }).ok) {
  console.log("Ce dossier est déjà relié à un projet Railway.");
} else {
  if (!railway(["init", "--name", "blind-quizz"]).ok) fail("Impossible de créer le projet Railway.");
}
if (!railway(["service", "link", SERVICE], { quiet: true }).ok) {
  if (!railway(["add", "--service", SERVICE]).ok) fail(`Impossible de créer le service « ${SERVICE} ».`);
  if (!railway(["service", "link", SERVICE]).ok) fail(`Impossible de relier le service « ${SERVICE} ».`);
}
console.log(`Service « ${SERVICE} » prêt.`);

// 3. Variables
step(3, "Réglages (variables d'environnement)");
const env = readEnvLocal();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
if (!env.ADMIN_PASSWORD) {
  env.ADMIN_PASSWORD = (await rl.question("Choisissez un mot de passe pour la régie /admin : ")).trim();
}
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absents de .env.local.");
  const url = (await rl.question("URL Supabase (Entrée pour ignorer) : ")).trim();
  if (url) {
    env.SUPABASE_URL = url;
    env.SUPABASE_SERVICE_ROLE_KEY = (await rl.question("Clé service_role Supabase : ")).trim();
  }
}
rl.close();
const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_PASSWORD"].filter((k) => env[k]);
for (const k of keys) {
  const r = railway(["variable", "set", k, "--stdin", "--skip-deploys", "--service", SERVICE], { input: env[k], quiet: true });
  if (!r.ok) fail(`Impossible d'enregistrer la variable ${k}.`);
  console.log(`✓ ${k}`);
}
if (!env.SUPABASE_URL) console.log("⚠ Sans Supabase, les questions modifiées dans la régie seront perdues à chaque redéploiement.");

// 4. Déploiement
step(4, "Envoi du code et déploiement (quelques minutes)");
if (!railway(["up", "--detach", "--service", SERVICE]).ok) fail("Le déploiement a échoué (voir le message ci-dessus).");

// 5. Adresse publique
step(5, "Adresse publique");
let domain = "";
const list = railway(["domain", "list", "--service", SERVICE, "--json"], { quiet: true });
domain = list.out.match(/[a-z0-9-]+\.up\.railway\.app/i)?.[0] ?? "";
if (!domain) {
  const created = railway(["domain", "--service", SERVICE, "--json"], { quiet: true });
  domain = created.out.match(/[a-z0-9-]+\.up\.railway\.app/i)?.[0] ?? "";
}

console.log("\n\x1b[32m✔ C'est parti !\x1b[0m");
if (domain) {
  console.log(`
  Jeu complet       : https://${domain}
  Régie             : https://${domain}/admin
  Suivi             : https://${domain}/api/health  (doit afficher "ok": true)

  Le premier déploiement prend 2 à 4 minutes. Pour garder votre site Vercel, ajoutez dans
  Vercel → Settings → Environment Variables :
      NEXT_PUBLIC_GAME_SERVER_URL = https://${domain}
  puis faites « Redeploy ».`);
} else {
  console.log("Adresse non trouvée automatiquement : sur railway.com, service blind-quizz → Settings → Networking → Generate Domain.");
}
console.log("\nSuivre les journaux : npx @railway/cli logs --service " + SERVICE);
