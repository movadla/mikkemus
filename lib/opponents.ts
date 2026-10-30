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

/** The international players: thirty-one, one for each place in the world championship, each with a face of their own (the three women are Sofia, Mei and Emma). They come back in the bigger events. The jobs and the words are left out: only the numbers are the game's. They are sharper than anyone at Ly (16 to 27 mm against the pub's 29 to 49): the world championship is a sharper field than the pub. */
export const INTERNATIONALS: Opponent[] = [
  o("Max Hartmann", "GER", "", ["", ""], 101, 19),
  o("Stefano Rossi", "ITA", "", ["", ""], 102, 22),
  o("Sofia Moreau", "FRA", "", ["", ""], 103, 20),
  o("Viktor Kovac", "SVK", "", ["", ""], 104, 25),
  o("Matteo Bianchi", "ITA", "", ["", ""], 105, 21),
  o("Dmitri Novak", "CZE", "", ["", ""], 106, 23),
  o("Rafael Santos", "ESP", "", ["", ""], 108, 18),
  o("Samuel Okafor", "ENG", "", ["", ""], 109, 24),
  o("Luca Dubois", "FRA", "", ["", ""], 110, 17),
  o("Jonas Keller", "GER", "", ["", ""], 111, 26),
  o("Hugo Vermeer", "NED", "", ["", ""], 112, 21),
  o("Callum Reid", "SCO", "", ["", ""], 113, 23),
  o("Mei Tanaka", "JPN", "", ["", ""], 114, 19),
  o("Pieter Visser", "NED", "", ["", ""], 115, 16),
  o("Marcus Williams", "ENG", "", ["", ""], 116, 22),
  o("Tomas Varga", "HUN", "", ["", ""], 117, 25),
  o("Bruno Alves", "POR", "", ["", ""], 118, 20),
  o("Jesper Holm", "DEN", "", ["", ""], 119, 24),
  o("Oskar Lund", "DEN", "", ["", ""], 120, 27),
  o("Ivan Petrov", "BUL", "", ["", ""], 121, 21),
  o("Henrik Lindqvist", "SWE", "", ["", ""], 122, 18),
  o("Felix Weber", "GER", "", ["", ""], 123, 23),
  o("Wyatt Brooks", "USA", "", ["", ""], 124, 20),
  o("Andre Santos", "BRA", "", ["", ""], 125, 22),
  o("Sven Bakker", "NED", "", ["", ""], 126, 19),
  o("Nils Jansen", "BEL", "", ["", ""], 127, 26),
  o("Emma Fischer", "GER", "", ["", ""], 128, 21),
  o("Dragan Kovacevic", "SRB", "", ["", ""], 129, 24),
  o("Emil Haugen", "NOR", "", ["", ""], 130, 25),
  o("Leon Moreau", "FRA", "", ["", ""], 131, 20),
  o("Kenji Sato", "JPN", "", ["", ""], 132, 18),
];

/** The five level bots of the ordinary tournament. Dave, Halfdan and Guro are in the Ly group, with the same faces and the same strength there. The two at the top stand above every international player on the world list. */
export const LEVEL_BOTS: Opponent[] = [
  o("Littler", "NED", "Verdens beste i vennegruppa", ["Aldri nervøs", "Maskinell"], 20, 14),
  o("Cor Dekker", "NED", "Rolig og presis", ["Bruker god tid", "Presis"], 21, 15.5),
  o("Dave", "NOR", "", ["", ""], 2, 30),
  o("Halfdan", "NOR", "", ["", ""], 16, 39),
  o("Guro", "NOR", "", ["", ""], 107, 49),
];

const NAMED = [...LY_REGULARS, ...INTERNATIONALS, ...LEVEL_BOTS];

/** Everyone with a name and a face, once each (the level bots Dave, Halfdan and Guro are in the Ly group already). */
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

/**
 * Everything known about a name: the named ones as written above, any other with a country from its surname, no face of its own (its initials
 * stand in, see portraitSrc) and a strength from the name that keeps it behind the known names (38 to 55 mm: a name nobody knows is not better than
 * Dave on paper).
 */
export function opponentOf(name: string): Opponent {
  const key = name.trim().toLowerCase();
  const named = NAMED.find((n) => squash(n.name) === squash(name));
  if (named) return named;
  const last = name.trim().split(/\s+/).slice(1).join(" ");
  const h = hash(key);
  return { name, nat: NAT_OF_LAST[last] ?? "NOR", job: "", styles: ["", ""], face: 0, med: 38 + (h % 18) };
}

/** The picture of a face number: 1 to 29 are the first set (p), 101 to 132 the second (n). 0 is no picture (portraitSrc gives the initials then). */
export const faceSrc = (face: number) => (face >= 100 ? `/career/opponents/n${String(face - 100).padStart(2, "0")}.webp` : `/career/opponents/p${String(face).padStart(2, "0")}.webp`);

/** The initials of a name: "Mikael Berg" is MB. */
export const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");

/** The colour of a name without a face, from the name: one of eight dark tones, so the initials read on them. */
const TONES = ["#4a3b6b", "#2f5f5b", "#6b3b3b", "#3b4f6b", "#5b5a2f", "#6b3b5e", "#2f5b3b", "#4f4f4f"];

/** The portrait of a name: the picture of a face it has, or its initials on a tone of its own (an SVG that any <img> draws). */
export function portraitSrc(name: string): string {
  const o = opponentOf(name);
  if (o.face > 0) return faceSrc(o.face);
  const tone = TONES[hash(name.trim().toLowerCase()) % TONES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${tone}"/><text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="40" font-weight="700" fill="#f3ead8">${initialsOf(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The country as a word for a line of text. */
export const NATION: Record<string, string> = { NOR: "Norge", SWE: "Sverige", DEN: "Danmark", NED: "Nederland", GER: "Tyskland", ITA: "Italia", CZE: "Tsjekkia", SVK: "Slovakia", SCO: "Skottland", JPN: "Japan", USA: "USA", BRA: "Brasil", POR: "Portugal", SRB: "Serbia", BEL: "Belgia", BUL: "Bulgaria", FRA: "Frankrike", ESP: "Spania", HUN: "Ungarn", ENG: "England" };
