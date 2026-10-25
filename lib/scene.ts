/**
 * Géométrie de la scène et de la "caméra".
 *
 * Tout le projet repose sur une seule idée : la photo est posée dans un plateau
 * de dimensions fixes (SCENE), et on ne déplace jamais les éléments dedans.
 * C'est le plateau entier qui est mis à l'échelle puis translaté — exactement
 * comme une caméra qui cadre un plan. Aucun calque ne peut donc se désaligner,
 * et aucun trou n'apparaît derrière qui que ce soit.
 */

/** Dimensions natives de la photo de groupe (px). */
export const SCENE = { width: 1080, height: 768 } as const;

/**
 * Plafond de zoom, en multiple du cadrage "cover".
 *
 * La source fait 1080 px de large : sur un écran de 1440 px, le cadrage plein
 * est déjà agrandi 1,33×. Autoriser 1,5× par-dessus reste tolérable ; au-delà,
 * les visages se dégradent franchement. Si une version haute résolution de la
 * photo arrive un jour, c'est la seule constante à relever.
 */
export const MAX_ZOOM = 1.5;

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** État de la caméra : échelle et point de la scène placé au centre de l'écran. */
export type Camera = { s: number; x: number; y: number };

export type Phase =
  | { phase: "intro"; t: number; index: -1 }
  | { phase: "person"; t: number; index: number }
  | { phase: "outro"; t: number; index: number };

export type Timeline = { intro: number; outro: number; seg: number; count: number };

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number) => clamp(value, 0, 1);

/** Interpolation douce, sans à-coup, entre deux bornes. */
export function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Rampe 0 → 1 entre `start` et `end` (utile pour les fondus). */
export const ramp = (value: number, start: number, end: number) =>
  smoothstep(start, end, value);

/** Échelle minimale pour que la photo couvre entièrement la fenêtre. */
export function coverScale(vw: number, vh: number, scene = SCENE) {
  return Math.max(vw / scene.width, vh / scene.height);
}

/**
 * Ramène une caméra dans les limites : on ne descend jamais sous le cadrage
 * "cover" (sinon des bords vides apparaissent) et on ne centre jamais un point
 * qui laisserait voir hors de la photo.
 */
export function clampCamera(cam: Camera, vw: number, vh: number, scene = SCENE): Camera {
  const s = Math.max(cam.s, coverScale(vw, vh, scene));
  const halfW = vw / (2 * s);
  const halfH = vh / (2 * s);

  const x =
    halfW * 2 >= scene.width
      ? scene.width / 2
      : clamp(cam.x, halfW, scene.width - halfW);
  const y =
    halfH * 2 >= scene.height
      ? scene.height / 2
      : clamp(cam.y, halfH, scene.height - halfH);

  return { s, x, y };
}

/** Cadrage d'accueil : la photo entière, sans déformation. */
export function homeCamera(vw: number, vh: number, scene = SCENE): Camera {
  return { s: coverScale(vw, vh, scene), x: scene.width / 2, y: scene.height / 2 };
}

/**
 * Cadrage sur une personne : on vise son visage, au zoom maximal autorisé,
 * puis on borne pour ne jamais sortir de l'image (donc jamais de vide, que ce
 * soit en paysage ou en portrait).
 */
export function focusCamera(
  focus: Point,
  vw: number,
  vh: number,
  zoom = MAX_ZOOM,
  scene = SCENE,
): Camera {
  return clampCamera(
    { s: coverScale(vw, vh, scene) * zoom, x: focus.x, y: focus.y },
    vw,
    vh,
    scene,
  );
}

export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  return {
    s: from.s + (to.s - from.s) * t,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/**
 * Transformation CSS du plateau. Le plateau a pour origine son coin haut-gauche
 * (`transform-origin: 0 0`), d'où la translation en pixels écran.
 */
export function cameraTransform(cam: Camera, vw: number, vh: number) {
  const tx = vw / 2 - cam.x * cam.s;
  const ty = vh / 2 - cam.y * cam.s;
  return `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${cam.s.toFixed(5)})`;
}

/** Découpe du scroll : ouverture, un segment par personne, fermeture. */
export function buildTimeline(count: number, intro = 0.1, outro = 0.1): Timeline {
  return { intro, outro, seg: (1 - intro - outro) / count, count };
}

const bodyStart = (tl: Timeline) => tl.intro;
const bodyEnd = (tl: Timeline) => tl.intro + tl.seg * tl.count;

/** Où en est le scroll : dans l'ouverture, sur une personne, ou dans la fermeture. */
export function segmentAt(tl: Timeline, progress: number): Phase {
  const p = clamp01(progress);

  if (p < bodyStart(tl)) {
    return { phase: "intro", t: tl.intro === 0 ? 1 : p / tl.intro, index: -1 };
  }
  if (p >= bodyEnd(tl)) {
    const t = tl.outro === 0 ? 1 : (p - bodyEnd(tl)) / tl.outro;
    return { phase: "outro", t: clamp01(t), index: tl.count - 1 };
  }

  const u = (p - bodyStart(tl)) / tl.seg;
  const index = Math.min(tl.count - 1, Math.max(0, Math.floor(u)));
  return { phase: "person", t: u - index, index };
}

/**
 * Caméra à un instant du scroll. La caméra glisse sur la première moitié de
 * chaque segment puis tient le cadre, ce qui laisse le temps de lire la fiche.
 */
export function cameraAt(
  tl: Timeline,
  progress: number,
  home: Camera,
  targets: Camera[],
): Camera {
  const segment = segmentAt(tl, progress);
  if (targets.length === 0) return home;

  if (segment.phase === "intro") {
    return lerpCamera(home, targets[0], smoothstep(0.35, 1, segment.t));
  }
  if (segment.phase === "outro") {
    return lerpCamera(
      targets[targets.length - 1],
      home,
      smoothstep(0, 0.65, segment.t),
    );
  }

  const from = segment.index === 0 ? targets[0] : targets[segment.index - 1];
  return lerpCamera(from, targets[segment.index], smoothstep(0, 0.45, segment.t));
}

/** Voile flou : allumé pendant toute la visite, éteint aux deux extrémités. */
export function focusAmount(tl: Timeline, progress: number) {
  const p = clamp01(progress);
  if (p < bodyStart(tl)) {
    return smoothstep(0.5, 1, tl.intro === 0 ? 1 : p / tl.intro);
  }
  if (p >= bodyEnd(tl)) {
    const t = tl.outro === 0 ? 1 : (p - bodyEnd(tl)) / tl.outro;
    return 1 - smoothstep(0.15, 0.6, t);
  }
  return 1;
}

/**
 * Opacité de la silhouette nette d'une personne. Les fenêtres se chevauchent
 * légèrement autour des frontières : le sortant et l'entrant se croisent, donc
 * on ne voit jamais un plan entièrement flou sans personne nette.
 */
export function personOpacity(tl: Timeline, index: number, progress: number) {
  const start = bodyStart(tl) + index * tl.seg;
  const end = start + tl.seg;
  const enter = smoothstep(start - 0.06 * tl.seg, start + 0.1 * tl.seg, progress);
  const leave = 1 - smoothstep(end + 0.02 * tl.seg, end + 0.14 * tl.seg, progress);
  return enter * leave;
}

/** Opacité de la fiche : apparaît après l'arrivée de la caméra, part avant elle. */
export function cardOpacity(tl: Timeline, index: number, progress: number) {
  const start = bodyStart(tl) + index * tl.seg;
  const end = start + tl.seg;
  const enter = smoothstep(start + 0.28 * tl.seg, start + 0.46 * tl.seg, progress);
  const leave = 1 - smoothstep(end - 0.2 * tl.seg, end - 0.06 * tl.seg, progress);
  return enter * leave;
}

/** Titre d'ouverture : s'efface dès que la caméra part. */
export function introOpacity(progress: number) {
  return 1 - smoothstep(0.015, 0.06, progress);
}

/** Panneau de fin : n'apparaît qu'une fois le cadre revenu au plan large. */
export function finaleOpacity(progress: number) {
  return smoothstep(0.9, 0.98, progress);
}
