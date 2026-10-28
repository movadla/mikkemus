/**
 * The characters a player can be in the career. Each has a picture for every pose in public/career/chars/<id>/<pose>.webp: transparent, the
 * same size, and with the head in the same place, so one pose can be swapped for another without the head moving. A character that lacks a pose
 * uses its neutral one.
 */
export type Pose = "noytral" | "jubel" | "skuffet" | "kast";

export type Character = {
  id: string;
  /** What it is called in the picker: a description, not a name. */
  name: string;
  /** The colour of its light and its glow. */
  tint: string;
  poses: Partial<Record<Pose, string>>;
};

const poses = (id: string, which: Pose[]): Partial<Record<Pose, string>> => Object.fromEntries(which.map((p) => [p, `/career/chars/${id}/${p}.webp`]));

export const CHARACTERS: Character[] = [
  { id: "c03", name: "Skjegg og tatoveringer", tint: "#e8553a", poses: poses("c03", ["noytral", "jubel", "skuffet", "kast"]) },
  { id: "c02", name: "Skallen", tint: "#4cc24a", poses: poses("c02", ["noytral", "jubel", "skuffet", "kast"]) },
];

export const DEFAULT_CHARACTER = CHARACTERS[0].id;

/** The character with this id, or the first one when the id is unknown (a career from before there were characters, or one saved by a newer app). */
export const characterOf = (id: string | undefined | null): Character => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

/** The picture of a pose, or the neutral one when the character has none. */
export const poseSrc = (character: Character, pose: Pose): string => character.poses[pose] ?? character.poses.noytral ?? "";

/** The pose that fits what happened: a title is a cheer, a pay-out without one is a nod, nothing at all is a letdown. */
export function poseFor(result: { place: string; prize: number } | null | undefined): Pose {
  if (!result) return "noytral";
  if (result.place === "winner") return "jubel";
  return result.prize > 0 ? "noytral" : "skuffet";
}
