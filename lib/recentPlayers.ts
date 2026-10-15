/**
 * Who played most recently, so the list of earlier players puts the people from last time first
 * instead of leaving everyone to be found in alphabetical order among thirty names.
 *
 * Kept on the device, like the other preferences: it is about how this board is used, not
 * something the players' records in Supabase need to know.
 */
const STORAGE_KEY = "mikke-mus-recent-players";

export type PlayerUsage = Record<string, number>;

function key(name: string): string {
  return name.trim().toLowerCase();
}

export function readUsage(): PlayerUsage {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const usage: PlayerUsage = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v)) usage[k] = v;
    return usage;
  } catch {
    return {};
  }
}

/** Notes that these players are in a match that is starting now. Never throws. */
export function markPlayersUsed(names: string[], now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    const usage = readUsage();
    names.forEach((n) => {
      if (n.trim()) usage[key(n)] = now;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // Not remembering who played is not worth interrupting a match for.
  }
}

/** Most recently used first; everyone never used after them, in alphabetical order. */
export function sortByRecent(names: string[], usage: PlayerUsage): string[] {
  return [...names].sort((a, b) => {
    const ua = usage[key(a)] ?? 0;
    const ub = usage[key(b)] ?? 0;
    if (ua !== ub) return ub - ua;
    return a.localeCompare(b, "nb");
  });
}

/** Case-insensitive "contains" over the names, with a blank search meaning everyone. */
export function filterNames(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? names.filter((n) => n.toLowerCase().includes(q)) : names;
}

/**
 * A name that looks like it is a team rather than a person — "Vadla & Lars", "Moen og Hans".
 * People have been creating these as players to get a team name, which put them in the list of
 * players and in the statistics. Only a hint for the clean-up view: nothing is ever deleted
 * because of it.
 */
export function looksLikeTeam(name: string): boolean {
  return /\s(&|og|and)\s/i.test(name.trim());
}
