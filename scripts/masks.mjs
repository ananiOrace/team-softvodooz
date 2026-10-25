#!/usr/bin/env node
/**
 * Source des masques de découpe.
 *
 * Chaque silhouette est décrite par un ou plusieurs contours fermés, en
 * coordonnées de la scène (1080 × 768). Un contour = liste de points [x, y].
 * Le premier contour est le corps ; les suivants sont des ajouts (une mèche,
 * un bras) — tous en blanc, fusionnés.
 *
 *   node scripts/masks.mjs            -> écrit assets/masks/<id>.png
 *   node scripts/masks.mjs p09 p03    -> seulement ces personnes
 *
 * Le rendu se fait sans anticrénelage excessif : c'est `scene:build` qui
 * adoucit l'alpha d'un pixel pour éviter l'effet sticker.
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCENE = { width: 1080, height: 768 };
const OUT = path.join(ROOT, "assets/masks");

/** @type {Record<string, number[][][]>} */
export const MASKS = {
  // Homme aux lunettes bleues, à l'extrême droite : isolé, contour simple.
  p09: [
    [
      [984, 160], [1007, 159], [1024, 164], [1040, 174], [1050, 188],
      [1056, 204], [1052, 225], [1046, 242], [1038, 258], [1034, 272],
      [1030, 282], [1040, 292], [1062, 301], [1076, 314], [1080, 326],
      [1080, 658], [911, 658], [908, 630], [906, 610], [903, 594],
      [890, 588], [884, 580], [879, 562], [876, 540], [874, 510],
      [876, 480], [881, 450], [886, 420], [892, 390], [900, 360],
      [911, 330], [924, 305], [932, 300], [947, 294], [960, 287],
      [970, 279], [976, 270], [970, 258], [966, 240], [966, 222],
      [970, 205], [975, 190], [979, 175],
    ],
  ],
  // Femme aux lunettes, tresses longues : le cas le plus délicat.
  p03: [
    [
      [262, 406], [274, 396], [290, 392], [306, 395], [320, 402],
      [329, 413], [334, 427], [335, 443], [332, 458], [329, 472],
      [332, 484], [338, 496], [346, 506], [354, 520], [360, 538],
      [363, 558], [364, 580], [363, 606], [361, 632], [357, 656],
      [352, 676], [344, 690], [330, 696], [312, 696], [294, 696],
      [276, 692], [258, 686], [240, 678], [224, 668], [210, 656],
      [200, 642], [192, 624], [187, 604], [183, 582], [182, 560],
      [184, 540], [190, 524], [198, 512], [208, 506], [220, 503],
      [232, 504], [244, 512], [252, 520], [258, 508], [262, 492],
      [262, 474], [263, 456], [264, 438], [263, 422],
    ],
  ],

  // Assise derrière le laptop : occlusion franche, bord bas = arête de l'écran.
  p10: [
    [
      [470, 418], [492, 414], [516, 414], [538, 418], [554, 426],
      [564, 436], [568, 448], [566, 460], [560, 470], [558, 480],
      [562, 490], [570, 500], [580, 512], [596, 526], [614, 540],
      [630, 556], [642, 574], [650, 594], [654, 616], [656, 640],
      [656, 664], [654, 684], [648, 696], [636, 700], [620, 700],
      [606, 696], [598, 688], [596, 670], [594, 650], [594, 626],
      [560, 624], [520, 624], [480, 624], [440, 624], [400, 624],
      [396, 610], [396, 590], [400, 572], [406, 556], [414, 542],
      [424, 530], [434, 520], [442, 510], [446, 500], [448, 490],
      [446, 482], [452, 470], [458, 456], [462, 442], [466, 428],
    ],
  ],
};

function toSvg(rings) {
  const polygons = rings
    .map((ring) => `<polygon points="${ring.map(([x, y]) => `${x},${y}`).join(" ")}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE.width}" height="${SCENE.height}">
    <rect width="100%" height="100%" fill="black"/>
    <g fill="white">${polygons}</g>
  </svg>`;
}

export async function generate(only = []) {
  await mkdir(OUT, { recursive: true });
  for (const [id, rings] of Object.entries(MASKS)) {
    if (only.length && !only.includes(id)) continue;
    await sharp(Buffer.from(toSvg(rings)))
      .png()
      .toFile(path.join(OUT, `${id}.png`));
    console.log(`assets/masks/${id}.png  (${rings.length} contour(s))`);
  }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (invokedDirectly) {
  const only = process.argv.slice(2);
  await generate(only);

  if (only.length === 0) {
    const ids = Object.keys(MASKS);
    await writeFile(
      path.join(OUT, "README.md"),
      `# Masques\n\nGénérés par \`node scripts/masks.mjs\` depuis les polygones de\n\`scripts/masks.mjs\`. Ne pas éditer les PNG à la main : corriger les points.\n\n` +
        `Découpés : ${ids.join(", ")}.\n`,
    );
  }
}
