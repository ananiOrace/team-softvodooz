// Outil de tracé (temporaire) : produit un crop agrandi avec une grille en
// coordonnées de la scène, pour relever les points des silhouettes.
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const team = JSON.parse(readFileSync(path.join(ROOT, "data/team.json"), "utf8"));
const source = path.join(ROOT, "public/scene/base.webp");
const out = path.join(ROOT, "tmp");

const args = process.argv.slice(2);
const scale = Number(process.env.SCALE ?? 2);

await mkdir(out, { recursive: true });

// Mode rectangle libre : `node scripts/trace.mjs rect:x,y,w,h.nom`
const rects = args
  .filter((a) => a.startsWith("rect:"))
  .map((a) => {
    const [coords, name] = a.slice(5).split(".");
    const [x, y, w, h] = coords.split(",").map(Number);
    return { id: name ?? "rect", box: { x, y, w, h } };
  });

const persons = args
  .filter((a) => !a.startsWith("rect:"))
  .map((id) => team.people.find((p) => p.id === id));

for (const { id, box } of [...persons, ...rects]) {
  if (!id || !box) throw new Error(`inconnu: ${id}`);
  const { x, y, w, h } = box;
  const width = w * scale;
  const height = h * scale;

  const grid = [];
  for (let gx = Math.ceil(x / 25) * 25; gx <= x + w; gx += 25) {
    const px = (gx - x) * scale;
    const major = gx % 100 === 0;
    grid.push(
      `<line x1="${px}" y1="0" x2="${px}" y2="${height}" stroke="${major ? "#00e5ff" : "#00e5ff55"}" stroke-width="1"/>`,
    );
    if (major) {
      grid.push(
        `<text x="${px + 3}" y="14" fill="#00e5ff" font-size="13" font-family="monospace">${gx}</text>`,
      );
    }
  }
  for (let gy = Math.ceil(y / 25) * 25; gy <= y + h; gy += 25) {
    const py = (gy - y) * scale;
    const major = gy % 100 === 0;
    grid.push(
      `<line x1="0" y1="${py}" x2="${width}" y2="${py}" stroke="${major ? "#ffd400" : "#ffd40055"}" stroke-width="1"/>`,
    );
    if (major) {
      grid.push(
        `<text x="3" y="${py - 4}" fill="#ffd400" font-size="13" font-family="monospace">${gy}</text>`,
      );
    }
  }

  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${grid.join("")}</svg>`,
  );

  await sharp(source)
    .extract({ left: x, top: y, width: w, height: h })
    .resize(width, height, { kernel: "nearest" })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toFile(path.join(out, `trace-${id}.png`));

  console.log(`tmp/trace-${id}.png  (box ${x},${y} ${w}x${h})`);
}
