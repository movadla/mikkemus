/**
 * What the money buys besides the room: darts, a coach and a way to travel, each in a few steps that are bought one after the other. The player
 * throws for real, so none of it makes the throw better; what it does is what the room does: the darts make the evening a little easier (the
 * opponents a touch weaker), the coach makes the training count for more and pay more, and the travel makes the entry fees cheaper. Each step is
 * bought once, kept for good, and written in the books.
 */
import { book } from "./ledger";
import { dollars, type Career } from "./career";

export type GearId = "darts" | "coach" | "travel";

export type GearStep = { name: string; /** What it costs to get here from the step before. */ price: number; /** What it does, in a line. */ about: string };

export type GearKind = { id: GearId; name: string; /** The steps, the first the one the career starts with (free). */ steps: GearStep[] };

/** How much weaker each set of darts bought makes the opponents (their MED is that much higher). */
const DARTS_BONUS = 0.02;

export const GEAR: GearKind[] = [
  {
    id: "darts",
    name: "Piler",
    steps: [
      { name: "Messingpiler", price: 0, about: "Pilene du begynte med" },
      { name: "Wolfram 80 %", price: 400, about: "Slankere piler som ligger tettere. Motstanderne 2 % svakere." },
      { name: "Wolfram 90 %", price: 1500, about: "Enda slankere. Motstanderne 4 % svakere." },
      { name: "Wolfram 97 %", price: 5000, about: "Så slanke som de blir. Motstanderne 6 % svakere." },
    ],
  },
  {
    id: "coach",
    name: "Trener",
    steps: [
      { name: "Ingen trener", price: 0, about: "Du trener på egen hånd" },
      { name: "Klubbtrener", price: 800, about: "Treningen flytter nivået dobbelt så fort" },
      { name: "Landslagstrener", price: 3000, about: "Stigen betaler dobbelt" },
      { name: "Mental trener", price: 8000, about: "Dagens øvelse betaler dobbelt" },
    ],
  },
  {
    id: "travel",
    name: "Reise",
    steps: [
      { name: "Til fots", price: 0, about: "Du kommer deg dit du skal" },
      { name: "Togkort", price: 600, about: "Innskuddene 15 % billigere" },
      { name: "Flykort", price: 2500, about: "Innskuddene 30 % billigere" },
    ],
  },
];

export const gearOf = (id: GearId): GearKind => GEAR.find((g) => g.id === id) ?? GEAR[0];

/** The step the player has of a kind of gear (0 for what the career started with). */
export const gearLevel = (career: Pick<Career, "gear">, id: GearId) => career.gear?.[id] ?? 0;

/** The step the player has, as it is. */
export const gearNow = (career: Pick<Career, "gear">, id: GearId): GearStep => gearOf(id).steps[gearLevel(career, id)];

/** The next step to buy, or null when the last one is bought. */
export const nextGear = (career: Pick<Career, "gear">, id: GearId): GearStep | null => gearOf(id).steps[gearLevel(career, id) + 1] ?? null;

/** Why the next step cannot be bought now, or null when it can. */
export function whyNotBuyGear(career: Career, id: GearId): string | null {
  const next = nextGear(career, id);
  if (!next) return "Ferdig";
  if (career.money < next.price) return `Mangler ${dollars(next.price - career.money)}`;
  return null;
}

/** Buys the next step: the money goes, the step is the player's, and it is in the books. */
export function buyGear(career: Career, id: GearId): Career {
  if (whyNotBuyGear(career, id)) return career;
  const next = nextGear(career, id)!;
  const gear = { darts: 0, coach: 0, travel: 0, ...(career.gear ?? {}), [id]: gearLevel(career, id) + 1 };
  return book({ ...career, money: career.money - next.price, gear }, "gear", `${gearOf(id).name}: ${next.name}`, -next.price);
}

/** Whether there is a step of some gear the player can afford: for the dot on the training button. */
export const gearBadge = (career: Career) => GEAR.some((g) => whyNotBuyGear(career, g.id) === null);

/** The factor the darts put on the opponents' MED: 1 with the first darts, a little over with better ones. */
export const dartsBonus = (career: Pick<Career, "gear">) => 1 + DARTS_BONUS * gearLevel(career, "darts");

/** How much faster the training moves the level with a coach: twice as fast with one. */
export const coachWeight = (career: Pick<Career, "gear">) => (gearLevel(career, "coach") >= 1 ? 2 : 1);

/** What a level of the ladder pays, with the coach that doubles it. */
export const climbPay = (career: Pick<Career, "gear">, base: number) => (gearLevel(career, "coach") >= 2 ? base * 2 : base);

/** What the drill of the day pays, with the coach that doubles it. */
export const dailyPay = (career: Pick<Career, "gear">, base: number) => (gearLevel(career, "coach") >= 3 ? base * 2 : base);

/** The share of an entry fee the travel takes off: nothing on foot, more with each card. */
export const feeDiscount = (career: Pick<Career, "gear">) => [0, 0.15, 0.3][gearLevel(career, "travel")] ?? 0.3;
