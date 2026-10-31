/**
 * What happens at the board, told to the show around the career (lib/access.tsx: the code that has it). The games say what just happened; whoever listens
 * (the commentators, the crowd) decides what to do with it. With nobody listening, saying it costs nothing, so the games can say it always.
 */
export type ShowEvent =
  | { kind: "180"; player: string }
  | { kind: "ton"; player: string; points: number }
  | { kind: "bust"; player: string }
  | { kind: "checkout"; player: string; points: number }
  | { kind: "leg"; winner: string; loser?: string }
  | { kind: "match"; winner: string; loser?: string }
  | { kind: "triple"; player: string; number: number }
  | { kind: "bull"; player: string }
  | { kind: "closed"; player: string; number: number }
  | { kind: "comeback"; player: string };

type Listener = (e: ShowEvent) => void;
const listeners = new Set<Listener>();

/** Says that something happened. Safe to call from anywhere, also on the server and with nobody listening. */
export function emitShow(e: ShowEvent): void {
  listeners.forEach((l) => {
    try {
      l(e);
    } catch {
      // A listener that breaks must never break a turn.
    }
  });
}

/** Listens for what happens at the board. Returns the way to stop. */
export function onShow(l: Listener): () => void {
  listeners.add(l);
  return () => void listeners.delete(l);
}
