/**
 * The calendar of a season: eight weeks, one tournament or happening in each. The five steps of the ladder stand in the plan (Ly, Region, NM, Grand
 * Slam, VM). The weeks between are TBA until an invitation comes (lib/careerWorld.ts), and then they are the tournament of the invitation.
 */
import { WEEKS_PER_SEASON, lifeOf, weekInSeason, type Invitation, type Life } from "./careerLife";
import type { Tier, TierId } from "./career";

export type Slot =
  | { week: number; kind: "tier"; tier: TierId; name: string }
  /** A tournament that is played when an invitation has come: the `key` is the one of the invitation. */
  | { week: number; kind: "invite"; key: string; name: string }
  /** The duel on television. */
  | { week: number; kind: "tv"; name: string };

export const CALENDAR: Slot[] = [
  { week: 1, kind: "tier", tier: "lu", name: "Ly-cupen" },
  { week: 2, kind: "invite", key: "trondheim", name: "Trondheim Open" },
  { week: 3, kind: "tier", tier: "region", name: "Regionmesterskapet" },
  { week: 4, kind: "invite", key: "stavanger", name: "Stavanger Open" },
  { week: 5, kind: "tier", tier: "nm", name: "Norgesmesterskapet" },
  { week: 6, kind: "tv", name: "TV Duell" },
  { week: 7, kind: "tier", tier: "gs", name: "Grand Slam" },
  { week: 8, kind: "tier", tier: "vm", name: "VM i dart" },
];

if (CALENDAR.length !== WEEKS_PER_SEASON) throw new Error("kalenderen må ha en uke for hver uke i sesongen");

/** What the week of the career holds in the plan. */
export const slotOf = (week: number): Slot => CALENDAR[weekInSeason(week) - 1];

/** The week of the season a step is played in. */
export const weekOfTier = (tier: TierId): number => CALENDAR.find((s) => s.kind === "tier" && s.tier === tier)?.week ?? 0;

/** The week of the season an invitation of this kind is played in, or 0 when no week has it. */
export const weekOfInvite = (key: string): number => CALENDAR.find((s) => s.kind === "invite" && s.key === key)?.week ?? 0;

/**
 * Why a step or an invitation cannot be played this week, or null when it is the one of the week. A step is played in its own week; an invitation in
 * the week of its kind, and only when it has come.
 */
export function notThisWeek(career: { life?: Life }, tier: Tier): string | null {
  const slot = slotOf(lifeOf(career).week);
  if ("city" in tier) {
    const key = (tier as Invitation).key;
    if (slot.kind === "invite" && slot.key === key) return null;
    const week = weekOfInvite(key);
    return week ? `Spilles i uke ${week}` : "Er ikke med i kalenderen";
  }
  if (slot.kind === "tier" && slot.tier === tier.id) return null;
  return `Spilles i uke ${weekOfTier(tier.id)}`;
}
