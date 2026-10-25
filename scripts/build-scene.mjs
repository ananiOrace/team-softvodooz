#!/usr/bin/env node
/**
 * Fabrique des calques de la scène à partir de la photo de groupe.
 *
 *   pnpm scene:build                 -> utilise assets/source/team-photo.jpg
 *   pnpm scene:build chemin/photo.jpg
 *   pnpm scene:build --placeholder   -> génère une scène neutre pour travailler
 *                                       la mécanique sans la vraie photo
 *
 * Produit, dans public/scene/ :
 *   base.webp        la photo, recadrée à la taille native de la scène
 *   base-blur.webp   la même, floutée / désaturée / assombrie (fond des focus)
 *   people/<id>.webp la partie visible de chaque personne, en alpha
 *
 * Les silhouettes ne sont générées que si un masque existe dans
 * assets/masks/<id>.png (blanc = on garde, noir = transparent). Le masque peut
 * être à n'importe quelle résolution : il est ramené à celle de la scène.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCENE = { width: 1080, height: 768 };

const args = process.argv.slice(2);
const placeholder = args.includes("--placeholder");
const explicitSource = args.find((a) => !a.startsWith("--"));

const SOURCE = explicitSource
  ? path.resolve(explicitSource)
  : path.join(ROOT, "assets/source/team-photo.jpg");

const OUT = path.join(ROOT, "public/scene");
const PEOPLE_OUT = path.join(OUT, "people");
const MASKS = path.join(ROOT, "assets/masks");

const team = JSON.parse(
  readFileSync(path.join(ROOT, "data/team.json"), "utf8"),
);

function placeholderScene() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE.width}" height="${SCENE.height}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3b2f28"/>
        <stop offset="0.55" stop-color="#6b5544"/>
        <stop offset="1" stop-color="#2a211c"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="47%" fill="#e8ddcd" font-family="Helvetica, Arial" font-size="44"
      text-anchor="middle" opacity="0.9">Photo de groupe à venir</text>
    <text x="50%" y="53%" fill="#c9b8a2" font-family="Helvetica, Arial" font-size="22"
      text-anchor="middle" opacity="0.75">déposez assets/source/team-photo.jpg</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildBase(input) {
  await mkdir(OUT, { recursive: true });

  await sharp(input)
    .resize(SCENE.width, SCENE.height, { fit: "cover", position: "centre" })
    .webp({ quality: 88, effort: 5 })
    .toFile(path.join(OUT, "base.webp"));

  // La copie floue est cuite une fois : le navigateur n'a qu'à faire varier son
  // opacité, ce qui évite un filter coûteux sur une image plein écran au scroll.
  await sharp(input)
    .resize(SCENE.width, SCENE.height, { fit: "cover", position: "centre" })
    .blur(11)
    .modulate({ saturation: 0.42, brightness: 0.52 })
    .webp({ quality: 72, effort: 5 })
    .toFile(path.join(OUT, "base-blur.webp"));

  console.log("  base.webp + base-blur.webp");
}

/** Intercale un canal alpha (masque) dans une image RGB. */
function withAlpha(rgb, alpha, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i += 1, j += 3) {
    out[i * 4] = rgb[j];
    out[i * 4 + 1] = rgb[j + 1];
    out[i * 4 + 2] = rgb[j + 2];
    out[i * 4 + 3] = alpha[i];
  }
  return out;
}

async function buildCutouts(input) {
  await mkdir(PEOPLE_OUT, { recursive: true });
  if (!existsSync(MASKS)) {
    console.log("  aucun dossier assets/masks/ : silhouettes non générées");
    return { made: [], missing: team.people.map((p) => p.id) };
  }

  const made = [];
  const missing = [];

  for (const person of team.people) {
    const maskPath = path.join(MASKS, `${person.id}.png`);
    const { x, y, w, h } = person.box;
    const box = {
      left: Math.round(x),
      top: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    };

    if (!existsSync(maskPath) || box.width <= 0 || box.height <= 0) {
      // Un masque retiré ne doit pas laisser traîner une silhouette périmée :
      // le site croit alors qu'une découpe existe alors qu'elle n'est plus à jour.
      await rm(path.join(PEOPLE_OUT, `${person.id}.webp`), { force: true });
      missing.push(person.id);
      continue;
    }

    const rgb = await sharp(input)
      .resize(SCENE.width, SCENE.height, { fit: "cover" })
      .extract(box)
      .removeAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer();

    // Un léger flou sur le masque adoucit le contour (cheveux, épaules) et
    // évite l'effet "sticker" quand la silhouette se pose sur le fond flou.
    const alpha = await sharp(maskPath)
      .resize(SCENE.width, SCENE.height, { fit: "cover" })
      .extract(box)
      .greyscale()
      .blur(0.8)
      .raw()
      .toBuffer();

    await sharp(
      withAlpha(rgb, alpha, box.width, box.height),
      { raw: { width: box.width, height: box.height, channels: 4 } },
    )
      .webp({ quality: 90, alphaQuality: 100, effort: 5 })
      .toFile(path.join(PEOPLE_OUT, `${person.id}.webp`));

    made.push(person.id);
  }

  return { made, missing };
}

async function main() {
  let input = SOURCE;

  if (placeholder) {
    console.log("Mode provisoire : scène neutre (pas de photo source).");
    input = await placeholderScene();
  } else if (!existsSync(SOURCE)) {
    console.error(`Photo introuvable : ${SOURCE}`);
    console.error("Déposez-la là, passez un chemin en argument, ou lancez --placeholder.");
    process.exitCode = 1;
    return;
  }

  console.log("Construction de la scène :");
  await buildBase(input);
  const { made, missing } = await buildCutouts(input);

  if (made.length) console.log(`  silhouettes : ${made.join(", ")}`);
  if (missing.length) {
    console.log(`  masques manquants : ${missing.join(", ")}`);
    console.log("  -> assets/masks/<id>.png (blanc = garder, noir = transparent)");
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        scene: SCENE,
        placeholder,
        cutouts: made,
        missing,
      },
      null,
      2,
    ) + "\n",
  );
}

await main();
