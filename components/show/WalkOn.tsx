"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { careerSound } from "@/lib/uiSound";
import { CharacterFigure } from "../CharacterFigure";
import { OpponentPortrait } from "../OpponentCard";
import { WALKON_MS, WALKON_REDUCED_MS, isSkipKey } from "./WalkOnLogic";

/** A low thump for the VS slamming in, made by the synthesizer: this plays after a tap, so the browser lets it. Fails silently. */
function thump() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.45);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* no sound is fine */
  }
}

/**
 * The walk-on before a big match, in full screen: the lights go down, the player walks in from the left and the opponent from the right, each with a
 * name plate, and VS slams in with a shake. Any tap, and Escape, Enter or Space, skips it; it is also over by itself, and then `onDone` shows the
 * intro card. It calls `onDone` exactly once.
 */
export function WalkOn({ player, character, playerRank, opponent, opponentRank, colour, onDone }: { player: string; character?: string; playerRank?: string; opponent: string; opponentRank?: string; colour: string; onDone: () => void }) {
  const done = useRef(onDone);
  const finished = useRef(false);
  useEffect(() => {
    done.current = onDone;
  });
  const finish = useRef(() => {
    if (finished.current) return;
    finished.current = true;
    done.current();
  });
  useEffect(() => {
    const end = finish.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const timers = [window.setTimeout(end, reduced ? WALKON_REDUCED_MS : WALKON_MS)];
    if (!reduced) {
      careerSound("crowd-2");
      timers.push(window.setTimeout(thump, 3100));
    }
    const onKey = (e: KeyboardEvent) => {
      if (!isSkipKey(e.key)) return;
      e.preventDefault();
      end();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div className="walkon" style={{ "--cup": colour } as CSSProperties} onClick={() => finish.current()} role="dialog" aria-label={`${player} mot ${opponent}`}>
      <div className="walkon-beam" aria-hidden />
      <div className="walkon-stage">
        <div className="walkon-side walkon-left">
          <CharacterFigure id={character} pose="noytral" glow className="walkon-fig" />
          <p className="walkon-plate">
            <b className="font-display">{player}</b>
            {playerRank && <span>{playerRank}</span>}
          </p>
        </div>
        <div className="walkon-side walkon-right">
          <div className="walkon-face">
            <OpponentPortrait name={opponent} />
          </div>
          <p className="walkon-plate">
            <b className="font-display">{opponent}</b>
            {opponentRank && <span>{opponentRank}</span>}
          </p>
        </div>
        <span className="walkon-vs font-display" aria-hidden>
          VS
        </span>
      </div>
      <button
        type="button"
        className="walkon-skip tactile"
        onClick={(e) => {
          e.stopPropagation();
          finish.current();
        }}
      >
        Hopp over
      </button>
    </div>
  );
}
