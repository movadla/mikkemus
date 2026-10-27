"use client";

import { useMemo, useState } from "react";
import { applyRound, bullOffDone, bullOffScore, currentGroup, simulateBullDarts, startBullOff, type BullDart, type BullOffState } from "@/lib/bullOff";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Segmented } from "./ui/Segmented";
import { ScreenTop } from "./ScreenTop";

const DART_LABELS: { value: string; label: string }[] = [
  { value: "0", label: "Bom" },
  { value: "1", label: "Bull" },
  { value: "2", label: "Bullseye" },
];

/** One round: a person throws three darts at the bull. A bot's are thrown for it, from how widely it scatters. */
function Round({ group, sigmas, photos, onConfirm }: { group: string[]; sigmas: Record<string, number | undefined>; photos: Record<string, string | null | undefined>; onConfirm: (points: Record<string, number>) => void }) {
  // The bots' darts are decided when the round starts and stay as they are.
  const botDarts = useMemo(() => Object.fromEntries(group.filter((n) => sigmas[n] !== undefined).map((n) => [n, simulateBullDarts(sigmas[n]!)])), [group, sigmas]);
  const [darts, setDarts] = useState<Record<string, (BullDart | null)[]>>(() => Object.fromEntries(group.filter((n) => sigmas[n] === undefined).map((n) => [n, [null, null, null]])));
  const complete = group.every((n) => botDarts[n] || darts[n]?.every((d) => d !== null));
  const dartsOf = (n: string): (BullDart | null)[] => botDarts[n] ?? darts[n];
  return (
    <>
      <div className="space-y-3 mb-6">
        {group.map((name) => {
          const mine = dartsOf(name);
          const bot = !!botDarts[name];
          const score = mine.every((d) => d !== null) ? bullOffScore(mine as BullDart[]) : null;
          return (
            <section key={name} className="card" aria-label={name}>
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={name} photo={photos[name]} size="m" bot={bot} />
                <p className="font-display flex-1 truncate" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                  {name}
                </p>
                <p className="tabular" style={{ color: "var(--color-gold-strong)", fontSize: "var(--text-title)", fontWeight: 700 }} aria-label="Poeng">
                  {score ?? "–"}
                </p>
              </div>
              <div className="space-y-2">
                {mine.map((d, i) =>
                  bot ? (
                    <p key={i} style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
                      {i + 1}. pil: {DART_LABELS[d ?? 0].label}
                    </p>
                  ) : (
                    <Segmented
                      key={i}
                      label={`${name}, ${i + 1}. pil`}
                      value={d === null ? "" : String(d)}
                      onChange={(v) => setDarts((cur) => ({ ...cur, [name]: cur[name].map((x, j) => (j === i ? (Number(v) as BullDart) : x)) }))}
                      options={DART_LABELS}
                    />
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
      <Button
        variant="primary"
        size="lg"
        block
        disabled={!complete}
        onClick={() => onConfirm(Object.fromEntries(group.map((n) => [n, bullOffScore((dartsOf(n) as BullDart[]) ?? [])])))}
      >
        {complete ? "Bekreft runden" : "Fyll inn alle pilene"}
      </Button>
    </>
  );
}

/**
 * The bull-off that settles a tie for a place (lib/bullOff.ts): the people who are level throw three darts each at the bull, the outer
 * bull worth 1 and the bullseye 2, and the most points is first. Level again, and the ones who are level throw again, until every
 * place is settled. `onDone` gets the people in the order they finished.
 */
export function BullOffScreen({
  group,
  context,
  sigmas,
  photos,
  onDone,
}: {
  group: string[];
  /** Which places and which match, in a line: «Plass 2 og 3 i Heat A». */
  context: string;
  /** For a bot: how widely it scatters, in millimetres. A person has none. */
  sigmas: Record<string, number | undefined>;
  photos: Record<string, string | null | undefined>;
  onDone: (order: string[]) => void;
}) {
  const [state, setState] = useState<BullOffState>(() => startBullOff(group));
  const [round, setRound] = useState(1);
  // After a round: who came out of it, so it is read before the next one starts.
  const [note, setNote] = useState<string | null>(null);
  const done = bullOffDone(state);
  const throwing = currentGroup(state);

  function confirm(points: Record<string, number>) {
    const next = applyRound(state, points);
    const sorted = [...throwing].sort((a, b) => (points[b] ?? 0) - (points[a] ?? 0));
    setNote(sorted.map((n) => `${n} ${points[n] ?? 0}`).join(" · "));
    setState(next);
    setRound((r) => r + 1);
  }

  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner">
        <ScreenTop title="Bull-off" />
        <p className="mb-1" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", fontWeight: 600 }}>
          {context}
        </p>
        <p className="mb-4" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          Tre piler mot bull. Bull gir 1 poeng og bullseye 2. Flest poeng er først, og er det likt kaster de som er like på nytt.
        </p>
        {note && (
          <p className="card mb-4" style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }} role="status">
            Forrige runde: {note}
            {!done && ". Fortsatt likt, ny runde for " + throwing.join(" og ") + "."}
          </p>
        )}
        {done ? (
          <>
            <ol className="card space-y-2 mb-6" aria-label="Rekkefølgen">
              {state.resolved.map((name, i) => (
                <li key={name} className="flex items-baseline gap-3" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                  <span className="font-display tabular" style={{ color: "var(--color-muted)" }}>
                    {i + 1}.
                  </span>
                  {name}
                </li>
              ))}
            </ol>
            <Button variant="primary" size="lg" block onClick={() => onDone(state.resolved)}>
              Videre
            </Button>
          </>
        ) : (
          <Round key={`${throwing.join("|")}-${round}`} group={throwing} sigmas={sigmas} photos={photos} onConfirm={confirm} />
        )}
      </div>
    </div>
  );
}
