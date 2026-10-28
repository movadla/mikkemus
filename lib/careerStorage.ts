import { DEFAULT_PROFILE, START_ARENA, type Career } from "./career";
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
  return { ...c, profile: c.profile ?? DEFAULT_PROFILE, worldTitles: c.worldTitles ?? 0, qualified: c.qualified ?? [], training: c.training ?? [], arena: { ...START_ARENA, ...(c.arena ?? {}) }, challenge: c.challenge ?? null, challenges: c.challenges ?? 0, active: old ? null : c.active };
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

/** Every career there is, the newest copy of each. */
export async function loadCareers(): Promise<Career[]> {
  const byId = new Map<string, Career>(readLocal().map((c) => [c.id, c]));
  if (supabase) {
    const { data, error } = await supabase.from("careers").select("data");
    if (!error && Array.isArray(data)) {
      for (const row of data as { data: Career }[]) {
        const c = row.data && normalize(row.data);
        if (!c || c.v !== 1 || typeof c.id !== "string") continue;
        const here = byId.get(c.id);
        if (!here || here.savedAt < c.savedAt) byId.set(c.id, c);
      }
    }
  }
  return [...byId.values()].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
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
