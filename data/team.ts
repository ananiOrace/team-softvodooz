import raw from "./team.json";
import type { Box, Point } from "@/lib/scene";

export type PersonLink = { label: string; href: string };

export type Person = {
  id: string;
  name: string;
  role: string;
  line: string;
  links: PersonLink[];
  /** Rectangle de la partie visible de la personne, en coordonnées de la scène. */
  box: Box;
  /** Point visé par la caméra (le visage). */
  focus: Point;
};

export const teamInfo = raw.team;
export const people = raw.people as Person[];

/** Ordre de la visite : de gauche à droite, tel qu'il a été validé. */
export const visitOrder = people;

/** Position de la fiche : à l'opposé du visage, pour ne jamais le masquer. */
export function cardSide(person: Person): "left" | "right" {
  return person.focus.x < 540 ? "right" : "left";
}
