import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  SCENE,
  buildTimeline,
  cameraAt,
  cameraTransform,
  cardOpacity,
  clampCamera,
  coverScale,
  finaleOpacity,
  focusAmount,
  focusCamera,
  homeCamera,
  personOpacity,
  segmentAt,
  type Camera,
} from "./scene";

/**
 * Un cadrage ne doit jamais laisser de bord vide : la photo couvre l'écran.
 * Tolérance 0,01 px : la transformation CSS arrondit à deux décimales.
 */
function expectFullCover(cam: Camera, vw: number, vh: number) {
  const [tx, ty] = translateOf(cam, vw, vh);
  expect(tx).toBeLessThanOrEqual(0.01);
  expect(ty).toBeLessThanOrEqual(0.01);
  expect(tx + SCENE.width * cam.s).toBeGreaterThanOrEqual(vw - 0.01);
  expect(ty + SCENE.height * cam.s).toBeGreaterThanOrEqual(vh - 0.01);
}

function translateOf(cam: Camera, vw: number, vh: number) {
  const match = cameraTransform(cam, vw, vh).match(
    /translate3d\(([-\d.]+)px, ([-\d.]+)px/,
  );
  if (!match) throw new Error("transformation illisible");
  return [Number(match[1]), Number(match[2])] as const;
}

const VIEWPORTS: Array<[number, number]> = [
  [1440, 900],
  [1920, 1080],
  [1280, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [820, 1180],
];

describe("cadrage", () => {
  it("le plan large couvre l'écran dans les deux orientations", () => {
    for (const [vw, vh] of VIEWPORTS) {
      expectFullCover(homeCamera(vw, vh), vw, vh);
    }
  });

  it("le plan large n'agrandit pas plus que nécessaire", () => {
    expect(coverScale(1440, 900)).toBeCloseTo(1440 / 1080, 5);
    expect(coverScale(500, 400)).toBeCloseTo(400 / SCENE.height, 5);
  });

  it("un visage au bord de la photo reste dans le cadre, sans bord vide", () => {
    const corners = [
      { x: 0, y: 0 },
      { x: SCENE.width, y: 0 },
      { x: 0, y: SCENE.height },
      { x: SCENE.width, y: SCENE.height },
      { x: 960, y: 255 },
    ];
    for (const [vw, vh] of VIEWPORTS) {
      for (const point of corners) {
        expectFullCover(focusCamera(point, vw, vh), vw, vh);
      }
    }
  });

  it("le zoom est plafonné", () => {
    for (const [vw, vh] of VIEWPORTS) {
      const cam = focusCamera({ x: 540, y: 405 }, vw, vh);
      expect(cam.s).toBeCloseTo(coverScale(vw, vh) * MAX_ZOOM, 5);
    }
  });

  it("sous le cadrage cover, l'échelle est remontée", () => {
    const tiny = clampCamera({ s: 0.1, x: 540, y: 405 }, 1440, 900);
    expect(tiny.s).toBeCloseTo(coverScale(1440, 900), 5);
  });
});

describe("segments de scroll", () => {
  const tl = buildTimeline(10);

  it("découpe l'ouverture, les personnes et la fermeture", () => {
    expect(segmentAt(tl, 0).phase).toBe("intro");
    expect(segmentAt(tl, tl.intro / 2).phase).toBe("intro");
    expect(segmentAt(tl, tl.intro + tl.seg * 0.5)).toMatchObject({
      phase: "person",
      index: 0,
    });
    expect(segmentAt(tl, tl.intro + tl.seg * 3.5)).toMatchObject({
      phase: "person",
      index: 3,
    });
    expect(segmentAt(tl, 0.999).phase).toBe("outro");
    expect(segmentAt(tl, 0.999).index).toBe(9);
  });

  it("couvre tout le scroll, sans trou entre deux personnes", () => {
    const tl10 = buildTimeline(10);
    for (let p = 0; p <= 1; p += 0.001) {
      const segment = segmentAt(tl10, p);
      expect(segment.t).toBeGreaterThanOrEqual(0);
      expect(segment.t).toBeLessThanOrEqual(1);
    }
  });
});

describe("caméra au fil du scroll", () => {
  const tl = buildTimeline(10);
  const targets = Array.from({ length: 10 }, (_, i) =>
    focusCamera({ x: 100 + i * 90, y: 300 }, 1440, 900),
  );
  const home = homeCamera(1440, 900);

  it("commence au plan large et finit au plan large", () => {
    expect(cameraAt(tl, 0, home, targets).x).toBeCloseTo(home.x, 4);
    const end = cameraAt(tl, 1, home, targets);
    expect(end.x).toBeCloseTo(home.x, 4);
    expect(end.s).toBeCloseTo(home.s, 4);
  });

  it("tient le cadre de la personne au milieu de son segment", () => {
    const i = 4;
    const mid = tl.intro + tl.seg * (i + 0.6);
    const cam = cameraAt(tl, mid, home, targets);
    expect(cam.x).toBeCloseTo(targets[i].x, 4);
    expect(cam.s).toBeCloseTo(targets[i].s, 4);
  });

  it("ne dépasse jamais le plafond de zoom, même en glissant", () => {
    for (let p = 0; p <= 1; p += 0.005) {
      expect(cameraAt(tl, p, home, targets).s).toBeLessThanOrEqual(
        coverScale(1440, 900) * MAX_ZOOM + 1e-6,
      );
    }
  });
});

describe("fondus", () => {
  const tl = buildTimeline(10);

  it("le voile flou est éteint au départ et à l'arrivée", () => {
    expect(focusAmount(tl, 0)).toBe(0);
    expect(focusAmount(tl, 1)).toBe(0);
    expect(focusAmount(tl, 0.5)).toBe(1);
  });

  it("une personne est nette pendant son segment, pas avant", () => {
    const i = 3;
    const start = tl.intro + tl.seg * i;
    expect(personOpacity(tl, i, start + tl.seg * 0.5)).toBeGreaterThan(0.99);
    expect(personOpacity(tl, i, tl.intro + tl.seg * 0.1)).toBe(0);
  });

  it("les silhouettes se croisent aux frontières (pas d'écran vide)", () => {
    const boundary = tl.intro + tl.seg * 5;
    const before = personOpacity(tl, 4, boundary);
    const after = personOpacity(tl, 5, boundary);
    expect(before + after).toBeGreaterThan(0.9);
  });

  it("les fiches apparaissent après la caméra et disparaissent avant elle", () => {
    const start = tl.intro + tl.seg * 2;
    expect(cardOpacity(tl, 2, start + tl.seg * 0.1)).toBe(0);
    expect(cardOpacity(tl, 2, start + tl.seg * 0.6)).toBeGreaterThan(0.9);
    expect(cardOpacity(tl, 2, start + tl.seg * 0.95)).toBe(0);
  });

  it("le panneau de fin n'apparaît qu'à la toute fin", () => {
    expect(finaleOpacity(0.8)).toBe(0);
    expect(finaleOpacity(1)).toBe(1);
  });
});
