"use client";

import { useEffect, useRef, useState } from "react";
import { useAccess } from "@/lib/access";
import { fxFlags, getFxLevel } from "@/lib/fxLevel";
import { onShow } from "@/lib/showBus";
import { commentate, crowdOf, type CommentaryLine } from "@/lib/showCommentary";
import { crowdSound, playConfetti, shakeScreen } from "./showFx";

const CHAR_MS = 18;
const LINE_GAP_MS = 120;
const HOLD_MS = 4200;
const INTRO_MS = 4800;

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Writes a text out a letter at a time (all at once for someone who has asked for less movement). */
function Typed({ text, delay }: { text: string; delay: number }) {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? delay : CHAR_MS);
    return () => clearTimeout(t);
  }, [n, text, delay]);
  return <>{text.slice(0, n)}</>;
}

/**
 * The show around a match in the career: a LIVE mark and a name banner at the start, two commentators who write out what happens at the
 * board, and the crowd (flash, shake, confetti, a roar) for the big moments. Drawn only with the show code; it never takes a tap.
 */
export function ShowOverlay(props: { player: string; opponent?: string; rival?: string }) {
  const { show } = useAccess();
  return show ? <ShowOverlayInner {...props} /> : null;
}

function ShowOverlayInner({ player, opponent, rival }: { player: string; opponent?: string; rival?: string }) {
  const [lines, setLines] = useState<{ id: number; items: CommentaryLine[] } | null>(null);
  const [flash, setFlash] = useState(0);
  const [intro, setIntro] = useState(true);
  const count180 = useRef<Record<string, number>>({});
  const idRef = useRef(0);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef({ player, opponent, rival });
  useEffect(() => {
    ctxRef.current = { player, opponent, rival };
  }, [player, opponent, rival]);

  useEffect(() => {
    const t = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const off = onShow((e) => {
      if (e.kind === "180") count180.current[e.player] = (count180.current[e.player] ?? 0) + 1;
      const c = ctxRef.current;
      const items = commentate(e, { me: c.player, opponent: c.opponent, rival: c.rival, count180: { ...count180.current } });
      setLines({ id: ++idRef.current, items });
      if (clearRef.current) clearTimeout(clearRef.current);
      const length = items.reduce((n, l) => n + l.text.length, 0) * CHAR_MS;
      clearRef.current = setTimeout(() => setLines(null), HOLD_MS + length);

      const level = getFxLevel();
      const fx = fxFlags(level);
      const crowd = crowdOf(e);
      if (crowd) crowdSound(crowd, level);
      if (crowd === "cheer") {
        if (fx.shake) {
          setFlash((f) => f + 1);
          shakeScreen();
        }
        if (fx.confetti && confettiRef.current) playConfetti(confettiRef.current, fx.bigConfetti ? 160 : 90);
      }
    });
    return () => {
      off();
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, []);

  return (
    <div className="show-live">
      {flash > 0 && <div key={flash} className="show-live-flash" aria-hidden />}
      <canvas ref={confettiRef} className="show-live-confetti" aria-hidden />
      <div className="show-live-top">
        <span className="show-live-badge" aria-label="Direkte">
          <i aria-hidden /> LIVE
        </span>
        {intro && (
          <div className="show-live-lower">
            <b>{player}</b>
            {opponent && <span>mot {opponent}</span>}
          </div>
        )}
        {lines && (
          <div className="show-live-comm" key={lines.id} role="status" aria-live="polite">
            {lines.items.map((l, i) => (
              <p key={i}>
                <em className={l.who === "Kåre" ? "kare" : "tove"}>{l.who}</em>
                <Typed text={l.text} delay={i === 0 ? 0 : lines.items[0].text.length * CHAR_MS + LINE_GAP_MS} />
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
