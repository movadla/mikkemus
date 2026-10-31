"use client";

/**
 * The card of the last results before the opening of a big event: "Tidligere", the names and the places, in the colours of the event. A tap goes
 * on to the opening, which has not started until then.
 */
export function Previously({ lines, c, top, bottom, onDone }: { lines: string[]; /** The colour of the event, and the top and bottom of its ground. */ c: string; top: string; bottom: string; onDone: () => void }) {
  return (
    <button type="button" className="previously tactile" aria-label="Tidligere: trykk for å gå videre" style={{ "--c": c, "--top": top, "--bot": bottom } as React.CSSProperties} onClick={onDone}>
      <small className="previously-kick">TIDLIGERE</small>
      <ol>
        {lines.map((l, i) => (
          <li key={i} style={{ "--i": `${0.15 + i * 0.25}s` } as React.CSSProperties}>
            {l}
          </li>
        ))}
      </ol>
      <small className="previously-go">Trykk for å gå videre</small>
    </button>
  );
}
