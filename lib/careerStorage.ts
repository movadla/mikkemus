import { DEFAULT_PROFILE, LADDER, START_ARENA, type Career, type Trophy } from "./career";

/** Trophies for a career from before they were kept: one for each title in the history. */
function trophiesFromHistory(c: Career): Trophy[] {
  return (c.history ?? []).flatMap((h) => {
    const tier = LADDER.find((t) => t.name === h.event);
    return h.place === "winner" && tier ? [{ tier: tier.id, at: h.at, prize: h.prize }] : [];
  });
}
import { supabase } from "./supabaseClient";

/**
 * Careers are kept on the device at once, and in the table careers (supabase-setup-careers.sql) a moment later, so a career follows the
 * player between phones. A career is saved after every round, so the remote write waits for things to go quiet. The copy that was saved
 * last wins when the two differ. With no table, the device copy is all there is, and nothing breaks.
 */
const PREFIX = "mikke-mus-career:";
const REMOTE_DELAY_MS = 1200;

const wait = new Map<string, ReturnType<typeof setTimeout>>();
const latest = new Map<string, Career>();

/** A career from before it had a look, or one whose event was of an older kind, is brought up to date rather than dropped. */
function normalize(c: Career): Career {
  const old = c.active && !("cup" in c.active);
  return { ...c, profile: c.profile ?? DEFAULT_PROFILE, worldTitles: c.worldTitles ?? 0, qualified: c.qualified ?? [], trophies: c.trophies ?? trophiesFromHistory(c), training: c.training ?? [], arena: { ...START_ARENA, ...(c.arena ?? {}) }, challenge: c.challenge ?? null, challenges: c.challenges ?? 0, active: old ? null : c.active };
}

function readLocal(): Career[] {
  const found: Career[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const parsed = JSON.parse(localStorage.getItem(k) ?? "null") as Career | null;
      if (parsed && parsed.v === 1 && typeof parsed.id === "string") found.push(normalize(parsed));
    }
  } catch {
    /* Storage can be blocked: there are no local careers then. */
  }
  return found;
}

const newestFirst = (list: Career[]) => [...list].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

/** The careers on this device, at once: nothing waits for the network to show what is already here. */
export function readLocalCareers(): Career[] {
  return newestFirst(readLocal());
}

/** Two sets of careers made one, the newest copy of each. */
export function mergeCareers(a: Career[], b: Career[]): Career[] {
  const byId = new Map<string, Career>();
  for (const c of [...a, ...b]) {
    const here = byId.get(c.id);
    if (!here || here.savedAt < c.savedAt) byId.set(c.id, c);
  }
  return newestFirst([...byId.values()]);
}

/** How long to wait for the database before going on with what is on the device. */
const REMOTE_TIMEOUT_MS = 5000;

/** The careers in the database, or nothing when it cannot be reached (no network, a slow one, or no table). */
async function readRemote(): Promise<Career[]> {
  if (!supabase) return [];
  const client = supabase;
  try {
    const answer = await Promise.race([client.from("careers").select("data"), new Promise<null>((resolve) => setTimeout(() => resolve(null), REMOTE_TIMEOUT_MS))]);
    if (!answer || answer.error || !Array.isArray(answer.data)) return [];
    return (answer.data as { data: Career }[]).flatMap((row) => {
      const c = row.data && normalize(row.data);
      return c && c.v === 1 && typeof c.id === "string" ? [c] : [];
    });
  } catch {
    return [];
  }
}

/** Every career there is, the newest copy of each. */
export async function loadCareers(): Promise<Career[]> {
  return mergeCareers(readLocal(), await readRemote());
}

async function writeRemote(c: Career) {
  if (!supabase) return;
  const { error } = await supabase.from("careers").upsert({ id: c.id, data: c, updated_at: c.savedAt }, { onConflict: "id" });
  if (error) console.warn("Kunne ikke lagre karrieren:", error.message);
}

/** Saves a career: on the device now, in the database when it has been quiet for a moment. Returns the career as saved. */
export function saveCareer(c: Career): Career {
  const saved: Career = { ...c, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PREFIX + saved.id, JSON.stringify(saved));
  } catch {
    /* Full or blocked storage: the database copy still goes. */
  }
  latest.set(saved.id, saved);
  clearTimeout(wait.get(saved.id));
  wait.set(
    saved.id,
    setTimeout(() => {
      wait.delete(saved.id);
      const last = latest.get(saved.id);
      if (last) void writeRemote(last);
    }, REMOTE_DELAY_MS),
  );
  return saved;
}

export async function deleteCareer(id: string): Promise<void> {
  clearTimeout(wait.get(id));
  wait.delete(id);
  latest.delete(id);
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* Nothing to remove. */
  }
  if (!supabase) return;
  const { error } = await supabase.from("careers").delete().eq("id", id);
  if (error) console.warn("Kunne ikke slette karrieren:", error.message);
}
