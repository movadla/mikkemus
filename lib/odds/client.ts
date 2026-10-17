import type { GameVariant } from "../rules";
import { computeOdds, type SideOdds } from "./index";
import { buildOddsInput, type OddsMatch } from "./match";

type Reply = { id: number; result?: SideOdds[]; error?: string };

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { resolve: (r: SideOdds[]) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL("./oddsWorker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<Reply>) => {
      const pending = waiting.get(e.data.id);
      if (!pending) return;
      waiting.delete(e.data.id);
      if (e.data.result) pending.resolve(e.data.result);
      else pending.reject(new Error(e.data.error ?? "odds"));
    };
    w.onerror = () => {
      // The thread is gone: whatever was waiting is calculated here instead, and so is everything from now on.
      w.terminate();
      worker = null;
      waiting.forEach((p) => p.reject(new Error("worker")));
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * The odds for a match, worked out in a thread of its own so that a tap is never held up by them, or here on
 * the page's own thread if no worker can be had (an old browser, a test). Same answer either way.
 */
export async function computeOddsOffThread(match: OddsMatch, variant: GameVariant | null | undefined): Promise<SideOdds[]> {
  const w = typeof window === "undefined" ? null : getWorker();
  if (w) {
    try {
      return await new Promise<SideOdds[]>((resolve, reject) => {
        const id = ++nextId;
        waiting.set(id, { resolve, reject });
        w.postMessage({ id, match, variant });
      });
    } catch {
      // fall through to the page's own thread
    }
  }
  return computeOdds(buildOddsInput(match));
}
