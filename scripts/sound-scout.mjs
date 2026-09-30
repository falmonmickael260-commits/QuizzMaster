// Recherche de vrais enregistrements sonores sous licence compatible avec un usage commercial.
// Exécuté dans GitHub Actions (accès Internet complet) : node scripts/sound-scout.mjs <dossier>
//
// Source : Openverse (api.openverse.org), qui indexe Freesound et Wikimedia Commons avec leurs licences.
// Licences retenues : CC0, marque du domaine public, CC-BY (crédit obligatoire, usage commercial autorisé).
// Pour chaque candidat : téléchargement + analyse ffmpeg (loudness EBU R128, crête, écrêtage, bande passante).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const out = process.argv[2] || "sound-candidates";
fs.mkdirSync(path.join(out, "files"), { recursive: true });

const SLOTS = {
  ambience: ["studio audience ambience", "tv studio audience murmur", "theater audience murmur before show", "audience chatter indoor"],
  applause: ["studio audience applause", "audience applause", "applause clapping audience indoor"],
  cheer: ["audience cheering applause", "crowd cheer applause whistles", "audience cheer"],
  aww: ["audience aww", "crowd aww disappointed", "audience disappointed groan"],
  ooh: ["audience ooh", "crowd oooh", "audience gasp"],
  buzzer: ["game show buzzer", "wrong answer buzzer", "buzzer"],
  correct: ["game show correct answer", "service bell ding", "desk bell ding"],
  tick: ["clock ticking", "stopwatch ticking", "mechanical clock tick"],
  drumroll: ["snare drum roll", "drumroll cymbal", "drum roll"],
  cymbal: ["cymbal swell", "reverse cymbal", "cymbal crash"],
  wheel: ["prize wheel spin", "wheel of fortune clicker", "spinning wheel ratchet"],
  button: ["big button press", "game show buzzer button", "mechanical switch click"],
};

const OK_LICENSES = new Set(["cc0", "pdm", "by"]);
const MAX_BYTES = 4 * 1024 * 1024;
const PER_SLOT = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(q) {
  const u = new URL("https://api.openverse.org/v1/audio/");
  u.searchParams.set("q", q);
  u.searchParams.set("license", "cc0,pdm,by");
  u.searchParams.set("page_size", "20");
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(u, { headers: { "User-Agent": "BlindQuizz-sound-scout/1.0 (game dev; contact via GitHub)" } });
    if (r.status === 429) {
      await sleep(15000);
      continue;
    }
    if (!r.ok) {
      console.log(`  ! ${q}: HTTP ${r.status}`);
      return [];
    }
    const j = await r.json();
    return j.results || [];
  }
  return [];
}

function analyze(file) {
  const run = (args) => {
    try {
      return execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, ...args, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      return String(e.stderr || e.stdout || "");
    }
  };
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", file], { encoding: "utf8" }));
  const st = probe.streams.find((s) => s.codec_type === "audio") || {};
  const ebu = run(["-af", "ebur128=peak=true", "-vn"]);
  // ffmpeg écrit ces mesures sur stderr : on relance en capturant stderr
  const grab = (args) => {
    try {
      execFileSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, ...args, "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] });
      return "";
    } catch (e) {
      return String(e.stderr || "");
    }
  };
  const ebuLog = grab(["-af", "ebur128=peak=true"]) || ebu;
  const stats = grab(["-af", "astats=metadata=0:reset=0"]);
  const hi = grab(["-af", "highpass=f=8000,volumedetect"]);
  const all = grab(["-af", "volumedetect"]);
  const num = (re, s) => {
    const m = s.match(re);
    return m ? Number(m[1]) : null;
  };
  const lufs = num(/I:\s+(-?[\d.]+) LUFS/, ebuLog.split("Summary:").pop() || "");
  const truePeak = num(/Peak:\s+(-?[\d.]+) dBFS/, ebuLog.split("Summary:").pop() || "");
  const lra = num(/LRA:\s+(-?[\d.]+) LU/, ebuLog.split("Summary:").pop() || "");
  const overall = stats.split("Overall").pop() || "";
  return {
    codec: st.codec_name,
    sampleRate: Number(st.sample_rate) || null,
    channels: st.channels || null,
    bitRate: Number(probe.format?.bit_rate) || null,
    duration: Number(probe.format?.duration) || null,
    lufs,
    truePeak,
    lra,
    peakCount: num(/Peak count:\s+([\d.]+)/, overall),
    noiseFloor: num(/Noise floor dB:\s+(-?[\d.inf]+)/, overall),
    flatFactor: num(/Flat factor:\s+([\d.]+)/, overall),
    meanVolume: num(/mean_volume:\s+(-?[\d.]+) dB/, all),
    // énergie au-dessus de 8 kHz : un enregistrement « étouffé » ou très compressé en a très peu
    hiMeanVolume: num(/mean_volume:\s+(-?[\d.]+) dB/, hi),
  };
}

const manifest = [];
const seen = new Set();
for (const [slot, queries] of Object.entries(SLOTS)) {
  console.log(`\n== ${slot}`);
  const pool = [];
  for (const q of queries) {
    const res = await search(q);
    console.log(`  ${q}: ${res.length} résultats`);
    for (const r of res) {
      if (seen.has(r.id) || !OK_LICENSES.has(r.license)) continue;
      if (r.filesize && r.filesize > MAX_BYTES) continue;
      if (r.duration && r.duration > 90000) continue;
      seen.add(r.id);
      pool.push({ ...r, query: q });
    }
    await sleep(1500);
  }
  let kept = 0;
  for (const r of pool) {
    if (kept >= PER_SLOT) break;
    const ext = (r.filetype || path.extname(new URL(r.url).pathname).slice(1) || "bin").toLowerCase();
    const file = path.join(out, "files", `${slot}__${r.id}.${ext}`);
    try {
      const resp = await fetch(r.url, { headers: { "User-Agent": "BlindQuizz-sound-scout/1.0" } });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > MAX_BYTES || buf.length < 2000) continue;
      fs.writeFileSync(file, buf);
      const a = analyze(file);
      manifest.push({
        slot,
        query: r.query,
        id: r.id,
        file: path.relative(out, file),
        title: r.title,
        creator: r.creator,
        creator_url: r.creator_url,
        license: r.license,
        license_version: r.license_version,
        license_url: r.license_url,
        landing: r.foreign_landing_url,
        source: r.source,
        provider: r.provider,
        tags: (r.tags || []).map((t) => t.name).slice(0, 15),
        attribution: r.attribution,
        ...a,
      });
      kept++;
      console.log(`  + ${r.title} (${r.license}) ${a.duration?.toFixed(1)}s ${a.lufs} LUFS pic ${a.truePeak} hi ${a.hiMeanVolume}`);
    } catch (e) {
      console.log(`  ! ${r.title}: ${e.message}`);
    }
  }
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} candidats analysés.`);
