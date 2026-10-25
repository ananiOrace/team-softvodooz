// Aperçu du contour du masque, tracé sur la photo (et sur damier).
//   node scripts/preview-mask.mjs p09 [p03 ...]
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { MASKS } from "./masks.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const team = JSON.parse(readFileSync(path.join(ROOT, "data/team.json"), "utf8"));
const OUT = path.join(ROOT, "tmp");
const SCALE = Number(process.env.SCALE ?? 2);

await mkdir(OUT, { recursive: true });

for (const id of process.argv.slice(2)) {
  const person = team.people.find((p) => p.id === id);
  const rings = MASKS[id];
  if (!person || !rings) throw new Error(`inconnu ou sans masque: ${id}`);

  const rect = process.env.RECT
    ? process.env.RECT.split(",").map(Number)
    : null;
  const { x, y, w, h } = rect
    ? { x: rect[0], y: rect[1], w: rect[2], h: rect[3] }
    : person.box;
  const width = Math.round(w * SCALE);
  const height = Math.round(h * SCALE);

  // Contour vectoriel, aux coordonnées de la scène ramenées dans le crop.
  const stroke = rings
    .map(
      (ring) =>
        `<polygon points="${ring
          .map(([px, py]) => `${(px - x) * SCALE},${(py - y) * SCALE}`)
          .join(" ")}" fill="none" stroke="#ff00d4" stroke-width="1.5"/>`,
    )
    .join("");

  const outline = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${stroke}</svg>`,
  );

  await sharp(path.join(ROOT, "public/scene/base.webp"))
    .extract({ left: x, top: y, width: w, height: h })
    .resize(width, height, { kernel: "nearest" })
    .composite([{ input: outline, top: 0, left: 0 }])
    .png()
    .toFile(path.join(OUT, `outline-${id}.png`));

  console.log(`tmp/outline-${id}.png`);
}
