"use client";

import { useEffect, useState } from "react";
import { avatarAccent } from "@/lib/avatarAccent";
import type { Kit } from "@/lib/teamKit";
import { KitStage } from "./TeamKit";
import { Avatar } from "./ui/Avatar";
import { formatOdds } from "@/lib/odds/price";
import { portraitSrc } from "@/lib/opponents";
import { ArrowLeftIcon } from "./icons";
import { startIntroMusic, type IntroTrack } from "@/lib/uiSound";
import { venueOf, type VenueId } from "@/lib/venues";
import { picturesFor } from "./eventPictures";

export type LineupSide = {
  name: string;
  /** The team's shirt; absent for a lone player. */
  kit?: Kit | null;
  /** The people in a team, shown on its card. */
  members?: string[];
  /** A lone player's picture, or null for the initial. */
  photo?: string | null;
  isBot?: boolean;
  /** «7 seire på 12 kamper», or nothing for someone who has not played yet. */
  record?: string;
  /** The faces of the people in a team, for the picture of it (a photo, or a letter for someone with none). */
  memberFaces?: { name: string; photo?: string | null; isBot?: boolean }[];
  /** The odds on this side to win, before the first dart. */
  odds?: number;
  /** The chance this side wins, 0 to 1. Shown with the odds. */
  chance?: number;
  /** Mean distance of the darts from the target, in mm: lower is better. */
  med?: number | null;
  /** Share of the darts that counted, in percent. */
  hitPct?: number | null;
  /** Matches won. */
  wins?: number;
  /** Matches played: a win count says nothing without it, so the wins are shown as «2 av 8» and compared as a share. */
  played?: number;
};

/** What a place has around the line-up of a match played in it: the film (public/career, from the career), the song and the colour of the spotlights. */
const VENUE_SHOW: Partial<Record<VenueId, { film: string; track: IntroTrack; beam: string }>> = {
  lu: { film: "/career/pub-intro.mp4", track: "intro", beam: "var(--pic-beam-lu)" },
  vm: { film: "/career/walkon/vm.mp4", track: "intro-vm", beam: "var(--pic-beam-vm)" },
  tv: { film: "/career/tv-duel-intro.mp4", track: "intro-gs", beam: "var(--pic-beam-tv)" },
};
const BEAMS: [string, number, number][] = [["18%", 14, 0.5], ["50%", 10, 0.4], ["82%", 14, 0.5], ["34%", 20, 0.3], ["66%", 20, 0.3]];

/** The last second of every film is left out (the owner found them a little long). */
const FILM_TRIM_S = 1;

/** The film of the place, once, muted (the song of the place plays over it), without its last second; «Hopp over», a tap, the end or a film that cannot be played goes on. */
function VenueFilm({ src, onDone }: { src: string; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[59] bg-black" onClick={onDone}>
      <video
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        autoPlay
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration > FILM_TRIM_S * 2 && v.currentTime >= v.duration - FILM_TRIM_S) onDone();
        }}
        onEnded={onDone}
        onError={onDone}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
        className="absolute rounded-full font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]"
        style={{ right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))", minHeight: "var(--control)", padding: "0 1.25rem", background: "var(--pic-glass)", color: "var(--pic-ink)", border: "1px solid var(--pic-line)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)" }}
      >
        Hopp over
      </button>
    </div>
  );
}

/** The bars start to grow once the cards have turned in. */
const GROW_AFTER_MS = 900;

/** The longest the cards wait for the pictures: after this they come in with what has loaded, so the screen is never held back. */
const PICTURES_WAIT_MS = 700;

type Row = { label: string; a: number; b: number; low: boolean; fmt: (n: number) => string; /** What is written for each side when it is not just the number («2 av 8»). */ shown?: [string, string]; };

/** The rows both sides have a figure for, so that the two are always compared on the same things. */
function compareRows(sides: LineupSide[]): Row[] {
  if (sides.length !== 2) return [];
  const [x, y] = sides;
  const rows: Row[] = [];
  // The hit share first: it is what the two throw, and what both have a figure for as soon as each has played. Then the distance.
  if (x.hitPct != null && y.hitPct != null) rows.push({ label: "TREFF", a: x.hitPct, b: y.hitPct, low: false, fmt: (n) => `${Math.round(n)} %` });
  if (x.med && y.med) rows.push({ label: "MED", a: x.med, b: y.med, low: true, fmt: (n) => `${Math.round(n)} mm` });
  // The wins of each against the other, out of the matches they have played against each other: nothing when they have never met.
  if (x.wins !== undefined && y.wins !== undefined && x.played && y.played) {
    rows.push({ label: "INNBYRDES", a: (x.wins / x.played) * 100, b: (y.wins / y.played) * 100, low: false, fmt: (n) => `${Math.round(n)} %`, shown: [`${x.wins} av ${x.played}`, `${y.wins} av ${y.played}`] });
  }
  if (x.odds !== undefined && y.odds !== undefined) rows.push({ label: "ODDS", a: x.odds, b: y.odds, low: true, fmt: formatOdds });
  return rows;
}

/** How much of the two bars each side gets: the better the figure, the longer. */
const share = (r: Row, v: number) => (r.low ? 1 / v / (1 / r.a + 1 / r.b) : r.a + r.b === 0 ? 0.5 : v / (r.a + r.b));

/**
 * The line-up before the first dart, as on television: each side comes in as a foil card from the left
 * and the right under a «VS», and their figures grow towards each other bar by bar. It stays up until
 * «Fortsett» is pressed, so the figures can be read for as long as it takes, and then the board is there: there is no count down.
 * Three or more sides are listed instead of split in two. Every level but Enkel — see lib/fxLevel.ts.
 */
export function LineupIntro({ sides, onDone, onBack, venue, kicker = "ENKELTKAMP" }: { sides: LineupSide[]; onDone: () => void; /** Back out of the match before it starts (to the setup). */ onBack?: () => void; /** The place the match is played in: its picture behind the cards, its name on top, its song and spotlights, and its film when «Start kampen» is pressed. */ venue?: VenueId; /** The small word over the name of the place. */ kicker?: string }) {
  const [grow, setGrow] = useState(false);
  const place = venue ? venueOf(venue) : null;
  const show = venue ? VENUE_SHOW[venue] : undefined;
  const pics = place ? picturesFor({ id: place.tier, key: place.key }) : undefined;
  // The film of the place comes first, once; then the cards. Reduced motion goes straight to the cards.
  const [film, setFilm] = useState(() => !!show && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // The song of the place, from when the cards come up until they are left.
  // When «Start kampen» is pressed the song goes on under the board and fades out over three seconds.
  useEffect(() => (show ? startIntroMusic(show.track, 3000) : undefined), [show]);
  // A big screen (a TV, a laptop) gets larger cards, as the board does: read across a room.
  const [big] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1000px) and (min-height: 600px)").matches);
  // The cards come in once the faces are loaded and decoded (or after a short wait), so they never turn in empty and then jump to the finished card.
  const [ready, setReady] = useState(false);
  // The cards come in when the film is over.
  const shown = ready && !film;
  // Over the picture of a place the writing is light, whatever the theme.
  const ink = place ? "var(--pic-ink)" : "var(--color-cream)";
  const soft = place ? "var(--pic-soft)" : "var(--color-muted)";
  const rows = compareRows(sides);

  useEffect(() => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const srcs = sides.map((s) => (s.kit ? null : s.photo ?? (s.isBot ? portraitSrc(s.name) : null))).filter((x): x is string => !!x);
    const timer = setTimeout(go, PICTURES_WAIT_MS);
    Promise.all(
      srcs.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    ).then(() => {
      clearTimeout(timer);
      go();
    });
    return () => clearTimeout(timer);
    // Once, for the sides the intro was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setGrow(true), rows.length > 0 ? GROW_AFTER_MS : 0);
    return () => clearTimeout(t);
    // The bars grow once, after the cards are in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const two = sides.length === 2;
  const sideAccent = (x: LineupSide) => (x.kit ? x.kit.primary : avatarAccent(x.name));
  // A person in the one frame of the app, large; a team as its shirt on a stage, with the people under its name.
  const picture = (s: LineupSide, size: number) =>
    s.kit ? <KitStage kit={s.kit} size={size} /> : <Avatar name={s.name} photo={s.photo} px={size} bot={s.isBot} />;

  // A team at a place: the people are the picture (a half each, a letter for someone with no photo), the shirt a small one under it, then the name.
  const teamCard = (s: LineupSide, i: number) => {
    const accent = s.kit ? s.kit.primary : avatarAccent(s.name);
    return (
      <div
        key={s.name}
        className="edge relative rounded-2xl overflow-hidden flex flex-col items-center text-center pb-3"
        style={{
          "--edge-fill-image": `linear-gradient(165deg, color-mix(in srgb, ${accent} 34%, var(--color-panel)) 0%, var(--color-panel) 72%)`,
          "--edge-accent": accent,
          boxShadow: "var(--elevation-3)",
          animation: shown ? `foil-in 420ms ${i * 90}ms cubic-bezier(0.2,0.8,0.2,1) both` : "none",
          opacity: shown ? undefined : 0,
          isolation: "isolate",
        } as React.CSSProperties}
      >
        <div className="flex w-full" style={{ height: big ? 230 : 168 }}>
          {(s.memberFaces ?? []).slice(0, 2).map((m, j) => {
            const src = m.photo ?? (m.isBot ? portraitSrc(m.name) : null);
            return (
              <span key={m.name} className="relative flex-1 min-w-0 overflow-hidden flex items-center justify-center" style={{ background: `color-mix(in srgb, ${avatarAccent(m.name)} 38%, var(--color-panel))`, borderLeft: j ? "2px solid var(--color-panel)" : undefined }}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" draggable={false} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display" style={{ fontSize: big ? 96 : 72, color: "var(--color-cream)", lineHeight: 1 }}>{m.name.charAt(0).toUpperCase()}</span>
                )}
              </span>
            );
          })}
          {s.chance !== undefined && (
            <span className="absolute font-display rounded-lg px-2 py-1" style={{ left: 8, top: 8, background: "var(--pic-glass)", color: "var(--color-gold-strong)", fontSize: "var(--text-num)", lineHeight: 1 }}>
              {Math.round(s.chance * 100)}
              <small style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-micro)", letterSpacing: "0.14em", color: "var(--pic-faint)" }}>SJANSE</small>
            </span>
          )}
        </div>
        {s.kit && <div className="mt-2"><KitStage kit={s.kit} size={big ? 84 : 60} /></div>}
        {/* The whole name: it wraps and shrinks with its length instead of being cut with dots. */}
        <p className="font-display mt-1 w-full px-2" style={{ fontSize: `calc(${big ? "var(--text-num) * 1.4" : "var(--text-num)"} * ${s.name.length > 18 ? 0.62 : s.name.length > 12 ? 0.78 : 1})`, lineHeight: 1.08, color: "var(--color-cream)", overflowWrap: "anywhere" }}>
          {s.name}
        </p>
        {s.members && s.members.length > 0 && s.members.join(" og ") !== s.name && (
          <span className="truncate w-full px-2" style={{ color: "var(--color-text-2)", fontSize: "var(--text-micro)" }}>
            {s.members.join(" og ")}
          </span>
        )}
        <span aria-hidden className="foil-sheen" />
      </div>
    );
  };

  const card = (s: LineupSide, i: number) => {
    if (place && s.memberFaces && s.memberFaces.length > 0) return teamCard(s, i);
    // The card is washed in the colour that is theirs (a team's own shirt colour), so two cards side by side are two people and not one design twice.
    const accent = s.kit ? s.kit.primary : avatarAccent(s.name);
    return (
      <div
        key={s.name}
        className="edge relative rounded-2xl overflow-hidden flex flex-col items-center text-center px-2 pt-3 pb-3"
        style={{
          aspectRatio: "0.72",
          "--edge-fill-image": `linear-gradient(165deg, color-mix(in srgb, ${accent} 34%, var(--color-panel)) 0%, var(--color-panel) 72%)`,
          "--edge-accent": accent,
          boxShadow: "var(--elevation-3)",
          animation: shown ? `foil-in 420ms ${i * 90}ms cubic-bezier(0.2,0.8,0.2,1) both` : "none",
          opacity: shown ? undefined : 0,
          isolation: "isolate",
        } as React.CSSProperties}
      >
        {s.chance !== undefined && (
          <span className="absolute font-display" style={{ left: 10, top: 8, color: "var(--color-gold-strong)", fontSize: "var(--text-num)", lineHeight: 1 }}>
            {Math.round(s.chance * 100)}
            <small style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-micro)", letterSpacing: "0.14em", color: "var(--color-muted)" }}>SJANSE</small>
          </span>
        )}
        <div className={s.chance !== undefined ? "mt-8" : "mt-4"}>{picture(s, big ? (s.kit ? 150 : 160) : s.kit ? 104 : 112)}</div>
        <p className="font-display mt-3 w-full truncate" style={{ fontSize: big ? "calc(var(--text-num) * 1.4)" : "var(--text-num)", lineHeight: 1.05, color: "var(--color-cream)", letterSpacing: "0.02em", textShadow: "var(--shadow-text)", paddingBottom: "0.18em" }}>
          {s.name}
        </p>
        {/* The people of a team, as small faces. Their names are only written when the team has a name of its own: «Lars og Per» says it already. */}
        {s.members && s.members.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-1 w-full">
            {s.members.map((m) => (
              <Avatar key={m} name={m} px={big ? 32 : 26} />
            ))}
            {s.members.join(" og ") !== s.name && (
              <span className="truncate" style={{ color: "var(--color-text-2)", fontSize: "var(--text-micro)" }}>
                {s.members.join(" og ")}
              </span>
            )}
          </div>
        )}
        <span aria-hidden className="foil-sheen" />
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oppstilling"
      className="fixed inset-0 z-[58] flex items-center justify-center animate-screen-enter"
      style={{ background: "var(--color-bg)" }}
    >
      {pics && (
        <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ pointerEvents: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- one fixed picture from public/career */}
          <img src={pics.outside} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", objectPosition: pics.outsideFocus }} />
          <div className="absolute inset-0" style={{ background: "var(--pic-veil)" }} />
          {show && BEAMS.map(([x, a, o], i) => <div key={i} className="ev-beam" style={{ "--x": x, "--a": `${a}deg`, "--bo": o, "--beam": show.beam, "--b": `${i * 0.25}s` } as React.CSSProperties} />)}
        </div>
      )}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Tilbake"
          className="absolute z-10 inline-flex items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]"
          style={{ left: "max(1rem, env(safe-area-inset-left))", top: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))", width: "var(--control)", height: "var(--control)", background: place ? "var(--pic-glass)" : "var(--color-surface)", color: place ? "var(--pic-ink)" : "var(--color-cream)", border: place ? "1px solid var(--pic-line)" : "1px solid var(--color-border)" }}
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
      )}
      {place && (
        <div className="absolute left-0 right-0 text-center px-4" style={{ top: "max(4.5rem, calc(env(safe-area-inset-top) + 3rem))" }}>
          <p className="font-display" style={{ fontSize: "var(--text-micro)", letterSpacing: "0.28em", color: soft, textShadow: "var(--pic-shadow-s)" }}>{kicker}</p>
          <h1 className="font-display" style={{ fontSize: "clamp(1.9rem, 9vw, 3rem)", lineHeight: 1.05, color: ink, textShadow: "var(--pic-shadow-l)" }}>{place.name}</h1>
        </div>
      )}
      {two && (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: `linear-gradient(100deg, color-mix(in srgb, ${sideAccent(sides[0])} 22%, transparent) 0 49.5%, transparent 49.5% 50.5%, color-mix(in srgb, ${sideAccent(sides[1])} 22%, transparent) 50.5%)` }}
        />
      )}
      {two ? (
        <div className="relative w-full px-4 flex flex-col items-center gap-5" style={{ maxWidth: big ? "min(40rem, 100%, 80vh)" : "30rem", marginTop: "-6%" }}>
          <div className="relative w-full grid grid-cols-2 gap-3">
            {sides.map(card)}
            <span
              className="absolute flex items-center justify-center font-display rounded-full"
              style={{ left: "50%", top: "50%", width: 54, height: 54, marginLeft: -27, marginTop: -27, background: "var(--color-gold)", color: "#2b2000", fontSize: "var(--text-title)", animation: shown ? "lineup-vs 350ms 350ms cubic-bezier(0.2,0.9,0.3,1.3) both" : "none", opacity: shown ? undefined : 0, zIndex: 5, border: "3px solid var(--color-bg)" }}
            >
              VS
            </span>
          </div>
          {rows.length > 0 && (
            <div className="w-full grid gap-3 rounded-2xl px-3 py-3" style={{ ...(place ? { background: "var(--pic-panel)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)" } : {}), animation: shown ? "lineup-count 300ms 600ms ease-out both" : "none", opacity: shown ? undefined : 0 }}>
              {rows.map((r, i) => {
                const aBetter = r.low ? r.a < r.b : r.a > r.b;
                const tie = r.a === r.b;
                const bar = (v: number, left: boolean, better: boolean) => (
                  <div className="flex" style={{ height: 14, borderRadius: 7, background: "color-mix(in srgb, var(--shade) 30%, transparent)", overflow: "hidden", justifyContent: left ? "flex-end" : "flex-start" }}>
                    <i
                      style={{ display: "block", height: "100%", borderRadius: 7, width: grow ? `${Math.min(100, share(r, v) * 170)}%` : 0, transition: `width 800ms ${i * 220}ms cubic-bezier(0.2,0.9,0.2,1)`, background: better && !tie ? "var(--color-gold-strong)" : "var(--color-muted)" }}
                    />
                  </div>
                );
                return (
                  <div key={r.label} className="grid items-center gap-2" style={{ gridTemplateColumns: "3.6rem 1fr 4.6rem 1fr 3.6rem" }}>
                    <span className="font-display tabular" style={{ fontSize: "var(--text-body)", color: ink }}>{r.shown ? r.shown[0] : r.fmt(r.a)}</span>
                    {bar(r.a, true, aBetter)}
                    <span style={{ textAlign: "center", fontSize: "var(--text-micro)", letterSpacing: "0.12em", color: soft }}>{r.label}</span>
                    {bar(r.b, false, !aBetter)}
                    <span className="font-display tabular" style={{ fontSize: "var(--text-body)", color: ink, textAlign: "right" }}>{r.shown ? r.shown[1] : r.fmt(r.b)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full px-6 grid gap-3" style={{ maxWidth: "28rem" }}>
          {sides.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3 rounded-xl px-4 py-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", animation: `lineup-in-left 500ms ${i * 90}ms cubic-bezier(0.2,0.9,0.3,1.1) both` }}>
              {picture(s, s.kit ? 52 : 52)}
              <span className="font-display flex-1 truncate" style={{ fontSize: "var(--text-title)" }}>{s.name}</span>
              {s.record && <span style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>{s.record}</span>}
              {s.odds !== undefined && <span className="font-display" style={{ color: "var(--color-gold)" }}>{formatOdds(s.odds)}</span>}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        autoFocus
        onClick={onDone}
        className="glossy absolute rounded-full font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]"
        style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", left: "max(1rem, env(safe-area-inset-left))", right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))", minHeight: "var(--control-lg)", padding: "0 1.5rem", fontSize: "var(--text-title)", animation: "lineup-count 300ms 500ms ease-out both" } as React.CSSProperties}
      >
        {place ? "Start kampen" : "Fortsett"}
      </button>
      {film && show && <VenueFilm src={show.film} onDone={() => setFilm(false)} />}
    </div>
  );
}
