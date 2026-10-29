/**
 * The people a player meets: the regulars of Ly, the first of the international players and the five level bots of the ordinary tournament.
 * Each has a face (public/career/opponents/pNN.webp), a country and, for the named ones, a job and two words for how they throw. The jobs and
 * the words are only colour: nothing in the game is steered by them. A name that is not here (the rest of a field of 32) gets a country from its
 * surname and a face from the international set, chosen from the name, chosen from the name, so the same name always has the same face.
 */
export type Opponent = {
  name: string;
  /** ISO-like country code, three letters. */
  nat: string;
  job: string;
  styles: [string, string];
  /** The number of the picture, 1 to 29. */
  face: number;
  /** A fixed strength (MED in mm) for the world ranking, so the lists do not change from one tournament to the next. */
  med: number;
};

const o = (name: string, nat: string, job: string, styles: [string, string], face: number, med: number): Opponent => ({ name, nat, job, styles, face, med });

/** The regulars of Ly: the group that plays together. No jobs and no words about how they throw: they are real, and only they can say. The strengths are the ones the game gives them (Dave, Chris Bell and Kjetil are level bots 3, 4 and 5 of the ordinary tournament). */
export const LY_REGULARS: Opponent[] = [
  o("Chris Bell", "NOR", "", ["", ""], 1, 31),
  o("Dave", "NOR", "", ["", ""], 2, 29),
  o("Dan", "NOR", "", ["", ""], 3, 36),
  o("Nikolai", "NOR", "", ["", ""], 4, 35),
  o("Thomas", "NOR", "", ["", ""], 5, 43),
  o("Bent", "NOR", "", ["", ""], 6, 45),
  o("Geir", "NOR", "", ["", ""], 7, 40),
  o("Kalle", "NOR", "", ["", ""], 8, 44),
  o("Joachim", "NOR", "", ["", ""], 9, 48),
  o("Kjetil", "NOR", "", ["", ""], 10, 34),
  o("Anders", "NOR", "", ["", ""], 11, 38),
  o("Olav Johann", "NOR", "", ["", ""], 12, 41),
  o("Bohlin", "NOR", "", ["", ""], 13, 32.5),
  o("Haakon", "NOR", "", ["", ""], 14, 46),
  o("Marcus", "NOR", "", ["", ""], 15, 47),
  o("Guro", "NOR", "", ["", ""], 107, 49),
  o("Halfdan", "NOR", "", ["", ""], 16, 39),
  o("Svein", "NOR", "", ["", ""], 17, 42),
];

/** The international players: thirty-one, one for each place in the world championship, each with a face of their own (the three women are Sofia, Mei and Emma). They come back in the bigger events. The jobs and the words are left out: only the numbers are the game's. */
export const INTERNATIONALS: Opponent[] = [
  o("Max Hartmann", "GER", "", ["", ""], 101, 27),
  o("Stefano Rossi", "ITA", "", ["", ""], 102, 30),
  o("Sofia Moreau", "FRA", "", ["", ""], 103, 28),
  o("Viktor Kovac", "SVK", "", ["", ""], 104, 33),
  o("Matteo Bianchi", "ITA", "", ["", ""], 105, 29),
  o("Dmitri Novak", "CZE", "", ["", ""], 106, 31),
  o("Rafael Santos", "ESP", "", ["", ""], 108, 26),
  o("Samuel Okafor", "ENG", "", ["", ""], 109, 32),
  o("Luca Dubois", "FRA", "", ["", ""], 110, 25),
  o("Jonas Keller", "GER", "", ["", ""], 111, 34),
  o("Hugo Vermeer", "NED", "", ["", ""], 112, 29),
  o("Callum Reid", "SCO", "", ["", ""], 113, 31),
  o("Mei Tanaka", "JPN", "", ["", ""], 114, 27),
  o("Pieter Visser", "NED", "", ["", ""], 115, 24),
  o("Marcus Williams", "ENG", "", ["", ""], 116, 30),
  o("Tomas Varga", "HUN", "", ["", ""], 117, 33),
  o("Bruno Alves", "POR", "", ["", ""], 118, 28),
  o("Jesper Holm", "DEN", "", ["", ""], 119, 32),
  o("Oskar Lund", "DEN", "", ["", ""], 120, 35),
  o("Ivan Petrov", "BUL", "", ["", ""], 121, 29),
  o("Henrik Lindqvist", "SWE", "", ["", ""], 122, 26),
  o("Felix Weber", "GER", "", ["", ""], 123, 31),
  o("Wyatt Brooks", "USA", "", ["", ""], 124, 28),
  o("Andre Santos", "BRA", "", ["", ""], 125, 30),
  o("Sven Bakker", "NED", "", ["", ""], 126, 27),
  o("Nils Jansen", "BEL", "", ["", ""], 127, 34),
  o("Emma Fischer", "GER", "", ["", ""], 128, 29),
  o("Dragan Kovacevic", "SRB", "", ["", ""], 129, 32),
  o("Emil Haugen", "NOR", "", ["", ""], 130, 33),
  o("Leon Moreau", "FRA", "", ["", ""], 131, 28),
  o("Kenji Sato", "JPN", "", ["", ""], 132, 26),
];

/** The five level bots of the ordinary tournament. Dave, ChrisBell and Kjetil are in the Ly group and have the same faces there. */
export const LEVEL_BOTS: Opponent[] = [
  o("Littler", "NED", "Verdens beste i vennegruppa", ["Aldri nervøs", "Maskinell"], 20, 20),
  o("Cor Dekker", "NED", "Rolig og presis", ["Bruker god tid", "Presis"], 21, 25),
  o("Dave", "NOR", "", ["", ""], 2, 30),
  o("ChrisBell", "NOR", "", ["", ""], 1, 39),
  o("Kjetil", "NOR", "", ["", ""], 10, 49),
];

const NAMED = [...LY_REGULARS, ...INTERNATIONALS, ...LEVEL_BOTS];

/** Everyone with a name and a face, once each (the level bots Dave, ChrisBell and Kjetil are in the Ly group already). */
export const EVERYONE: Opponent[] = [...LY_REGULARS, ...INTERNATIONALS, ...LEVEL_BOTS.filter((b) => !LY_REGULARS.some((r) => r.face === b.face))];
const squash = (n: string) => n.toLowerCase().replace(/\s+/g, "");

/** A country from a surname, for the generated names of the big events. */
const NAT_OF_LAST: Record<string, string> = {
  Berg: "NOR", Holm: "DEN", Dahl: "SWE", Lund: "DEN", Strand: "NOR", Vik: "NOR", Moe: "NOR", Brandt: "GER", Keller: "GER", Rossi: "ITA", Visser: "NED", Novak: "CZE", Kovac: "SVK", Lindqvist: "SWE", Hartmann: "GER", Dubois: "FRA", Moreau: "FRA", Jansen: "NED", Bakker: "NED", Fischer: "GER", Weber: "GER", Olsen: "NOR", Nygård: "NOR", Solberg: "NOR", Haugen: "NOR", Berntsen: "NOR", Engen: "NOR", Rud: "NOR", Foss: "NOR", Ruud: "NOR", Santos: "ESP", Varga: "HUN",
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Everything known about a name: the named ones as written above, any other with a country from its surname and a face from its name. */
export function opponentOf(name: string): Opponent {
  const key = name.trim().toLowerCase();
  const named = NAMED.find((n) => squash(n.name) === squash(name));
  if (named) return named;
  const last = name.trim().split(/\s+/).slice(1).join(" ");
  const h = hash(key);
  return { name, nat: NAT_OF_LAST[last] ?? "NOR", job: "", styles: ["", ""], face: 101 + (h % 32), med: 28 + (h % 36) };
}

/** The picture of a face number: 1 to 29 are the first set (p), 101 to 132 the second (n). */
export const faceSrc = (face: number) => (face >= 100 ? `/career/opponents/n${String(face - 100).padStart(2, "0")}.webp` : `/career/opponents/p${String(face).padStart(2, "0")}.webp`);

/** The country as a word for a line of text. */
export const NATION: Record<string, string> = { NOR: "Norge", SWE: "Sverige", DEN: "Danmark", NED: "Nederland", GER: "Tyskland", ITA: "Italia", CZE: "Tsjekkia", SVK: "Slovakia", SCO: "Skottland", JPN: "Japan", USA: "USA", BRA: "Brasil", POR: "Portugal", SRB: "Serbia", BEL: "Belgia", BUL: "Bulgaria", FRA: "Frankrike", ESP: "Spania", HUN: "Ungarn", ENG: "England" };
