// Prépare les personnages 3D du jeu à partir des packs CC0 de Quaternius (assets-src/) :
// retire les armes, ne garde que les animations utiles au plateau et écrit public/models/<fichier>.glb.
//   node scripts/prepare-models.mjs
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const SOURCES = [
  { dir: "assets-src/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX", prefix: "h" }, // Ultimate Modular Men
  { dir: "assets-src/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf", prefix: "f" }, // Ultimate Modular Women
];
const OUT = "public/models";
const WEAPONS = /pistol|gun|rifle|revolver|sword|knife|dagger|axe|shield|bow|spear|staff|wand|club/i;
const KEEP_ANIMS = /^(Idle|Idle_Neutral|Wave|Interact|HitRecieve|HitReceive|Yes|No|Victory|Jump|Clapping|Dance)$/i;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const { dir, prefix } of SOURCES) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".glb"))) {
    const name = f.replace(/^Individual_Characters_glTF_/, "").replace(/\.glb$/, "").toLowerCase().replace(/_/g, "-");
    const file = `${prefix}-${name === "casual-2" ? "casual" : name}`;
    const doc = await io.read(path.join(dir, f));
    const root = doc.getRoot();
    const removed = [];
    for (const n of root.listNodes()) {
      if (WEAPONS.test(n.getName()) && (n.getMesh() || n.listChildren().some((c) => c.getMesh()))) {
        removed.push(n.getName());
        n.dispose();
      }
    }
    const anims = [];
    for (const a of root.listAnimations()) {
      if (KEEP_ANIMS.test(a.getName())) anims.push(a.getName());
      else a.dispose();
    }
    await doc.transform(prune(), dedup());
    const target = path.join(OUT, `${file}.glb`);
    await io.write(target, doc);
    const kb = Math.round(fs.statSync(target).size / 1024);
    total += kb;
    console.log(`${file.padEnd(18)} ${String(kb).padStart(5)} Ko  animations: ${anims.join(", ")}${removed.length ? `  (retiré : ${removed.join(", ")})` : ""}`);
  }
}
console.log(`total ${total} Ko`);
