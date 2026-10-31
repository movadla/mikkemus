"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccess } from "@/lib/access";
import { PLACE_LABEL, dollars, type Career } from "@/lib/career";
import type { SeasonResult } from "@/lib/careerLife";
import { TROPHY } from "@/lib/scenePalette";
import { seasonFilm, type FilmScene } from "@/lib/show";
import { TrophyArt } from "../CareerTrophy";
import { CharacterFace, CharacterFigure } from "../CharacterFigure";
import { CloseIcon } from "../icons";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { FOCUS_RING } from "../ui/focus";

const TICK = 100;

/** One scene of the film. It is keyed by its place, so each comes up fresh. */
function Scene({ scene, career }: { scene: FilmScene; career: Career }) {
  switch (scene.kind) {
    case "title":
      return (
        <div className="film-scene film-center">
          <p className="film-kick">Se sesongen</p>
          <h2 className="film-big font-display">Sesong {scene.season}</h2>
          <div className="film-figure">
            <CharacterFigure id={career.profile.character} glow />
          </div>
          <p className="film-sub">{scene.player}</p>
        </div>
      );
    case "weeks":
      return (
        <div className="film-scene">
          <p className="film-kick">{scene.part === 1 ? "De første ukene" : "De siste ukene"}</p>
          <ol className="film-weeks">
            {scene.rows.map((r, i) => (
              <li key={r.week} data-win={r.place === "winner" ? "" : undefined} data-skip={r.skipped ? "" : undefined} style={{ "--i": `${i * 0.35}s` } as React.CSSProperties}>
                <small className="tabular">Uke {r.week}</small>
                <b>{r.name}</b>
                <span>{r.result}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "best":
      return (
        <div className="film-scene film-center">
          <p className="film-kick">Beste øyeblikk</p>
          <h2 className="film-big font-display">{PLACE_LABEL[scene.place]}</h2>
          <p className="film-sub">
            {scene.name} · uke {scene.week}
          </p>
        </div>
      );
    case "trophy":
      return (
        <div className="film-scene film-center">
          <p className="film-kick">{scene.cups.length === 1 ? "Pokal" : "Pokaler"}</p>
          <div className="film-cups">
            {scene.cups.map((c, i) => (
              <div key={c.name} className="film-cup" style={{ "--i": `${i * 0.3}s` } as React.CSSProperties}>
                {c.tier && <TrophyArt kind={c.tier} bare />}
                <b>{c.name}</b>
              </div>
            ))}
          </div>
        </div>
      );
    case "rival":
      return (
        <div className="film-scene film-center">
          <p className="film-kick">Rivalen</p>
          <div className="film-vs">
            <CharacterFace id={career.profile.character} px={72} />
            <b className="font-display tabular">
              {scene.w}–{scene.l}
            </b>
            <Avatar name={scene.name} bot px={72} />
          </div>
          <p className="film-sub">{scene.line}</p>
          <p className="film-fine">Alle møter med {scene.name} så langt</p>
        </div>
      );
    case "table":
      return (
        <div className="film-scene">
          <p className="film-kick">Sluttabellen</p>
          <ol className="season-table film-table">
            {scene.rows.map((r, i) => (
              <li key={r.name} className={r.me ? "me" : ""} style={{ "--i": `${i * 0.25}s` } as React.CSSProperties}>
                <span>{i + 1}</span>
                <b className="truncate">{r.name}</b>
                <span className="tabular">{r.pts}</span>
              </li>
            ))}
            {scene.rank > scene.rows.length && (
              <li className="me" style={{ "--i": `${scene.rows.length * 0.25}s` } as React.CSSProperties}>
                <span>{scene.rank}</span>
                <b className="truncate">{career.player}</b>
                <span className="tabular">{scene.points}</span>
              </li>
            )}
          </ol>
        </div>
      );
    case "end":
      return (
        <div className="film-scene film-center">
          <p className="film-kick">Sesong {scene.season} er over</p>
          <h2 className="film-big font-display tabular" style={{ color: scene.rank === 1 ? "var(--color-gold)" : "var(--color-cream)" }}>
            Nr. {scene.rank}
          </h2>
          <p className="film-sub">
            {scene.points} poeng{scene.prize > 0 ? ` · ${dollars(scene.prize)}` : ""}
          </p>
          <p className="film-fine">{scene.rank === 1 ? "Årets spiller" : `${scene.winner} er årets spiller`}</p>
        </div>
      );
  }
}

/** The film of a season: the scenes one after the other with a bar for each, a pause, a jump to the next and a way to play it again. */
function Film({ career, result, onClose }: { career: Career; result: SeasonResult; onClose: () => void }) {
  const [scenes] = useState(() => seasonFilm(career, result));
  // Where the film is: the scene and how long into it. One state, so a scene that ends moves on in the same step.
  const [pos, setPos] = useState({ at: 0, t: 0 });
  const [paused, setPaused] = useState(false);
  const { at, t } = pos;
  const done = at >= scenes.length;
  const scene = scenes[Math.min(at, scenes.length - 1)];
  useEffect(() => {
    if (paused || done) return;
    const id = setInterval(() => setPos((p) => (p.at < scenes.length && p.t + TICK >= scenes[p.at].ms ? { at: p.at + 1, t: 0 } : { at: p.at, t: p.t + TICK })), TICK);
    return () => clearInterval(id);
  }, [paused, done, scenes]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const next = () => setPos((p) => ({ at: Math.min(p.at + 1, scenes.length), t: 0 }));
  const restart = () => {
    setPos({ at: 0, t: 0 });
    setPaused(false);
  };
  return (
    <div className="film" role="dialog" aria-modal="true" aria-label="Sesongfilmen" style={{ "--c": TROPHY[scenes.some((s) => s.kind === "trophy") ? "vm" : "region"] } as React.CSSProperties}>
      <div className="film-bars" aria-hidden>
        {scenes.map((s, i) => (
          <i key={i}>
            <b style={{ width: i < at || done ? "100%" : i === at ? `${Math.min(100, (t / s.ms) * 100)}%` : "0%" }} />
          </i>
        ))}
      </div>
      <button type="button" aria-label="Lukk" onClick={onClose} className={`film-close tactile ${FOCUS_RING}`}>
        <CloseIcon className="w-5 h-5" />
      </button>
      <div className="film-stage" aria-live="polite">
        <Scene key={Math.min(at, scenes.length - 1)} scene={scene} career={career} />
      </div>
      <div className="film-controls">
        {done ? (
          <Button variant="primary" onClick={restart}>
            Spill om
          </Button>
        ) : (
          <>
            <Button onClick={() => setPaused((p) => !p)}>{paused ? "Spill" : "Pause"}</Button>
            <Button onClick={next}>Hopp over</Button>
          </>
        )}
        <Button onClick={onClose}>Lukk</Button>
      </div>
    </div>
  );
}

/** The button that offers the film of a season that is over. Only with the show; without it nothing is drawn. */
export function SeasonFilmButton({ career, result, label = "Se sesongen" }: { career: Career; result: SeasonResult; label?: string }) {
  const { show } = useAccess();
  const [open, setOpen] = useState(false);
  if (!show) return null;
  return (
    <>
      <Button block onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && typeof document !== "undefined" && createPortal(<Film career={career} result={result} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
