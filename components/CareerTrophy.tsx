"use client";

import { useId, useMemo, useRef, type CSSProperties } from "react";
import type { TierId } from "@/lib/career";
import { MATERIALS, RANK_LOOK, TIER_LOOK, foilVars, frameOf } from "@/lib/materials";
import { badgeSvg, trophySvg } from "@/lib/trophySvg";

/** The cups that have a photographed trophy (public/career/trophies/<id>.webp): it stands in for the drawn one wherever the cup is shown. */
export const TROPHY_PHOTO: Partial<Record<TierId, string>> = { lu: "/career/trophies/lu.webp", region: "/career/trophies/region.webp", nm: "/career/trophies/nm.webp", gs: "/career/trophies/gs.webp", vm: "/career/trophies/vm.webp" };

/** The cups of invitations, by the key of the invitation or the name of its trophy: they have a trophy of their own, not the one of the step they stand on. */
export const INVITE_TROPHY_PHOTO: Record<string, string> = { wc: "/career/trophies/wc.webp", "World Cup of Darts-pokalen": "/career/trophies/wc.webp" };

/**
 * The trophy of an event, in metal. `bare` is the trophy alone (cards, shelves, lists); without it it stands on a plinth with a shadow and a
 * reflection. With `tilt` it follows the finger or the pointer, and the gloss moves with it. It is an image: what it stands for is said by the
 * text next to it.
 */
export function TrophyArt({ kind, bare = false, tilt = false, className = "", style, variant }: { kind: TierId; bare?: boolean; tilt?: boolean; className?: string; style?: CSSProperties; /** The key or the trophy name of an invitation: its cup is not the one of the step it stands on. */ variant?: string }) {
  const photo = (variant !== undefined ? INVITE_TROPHY_PHOTO[variant] : undefined) ?? TROPHY_PHOTO[kind];
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const html = useMemo(() => trophySvg(kind, `t${id}_`, bare), [kind, id, bare]);
  const el = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    const box = el.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    box.style.setProperty("--ry", `${(x * 34).toFixed(1)}deg`);
    box.style.setProperty("--rx", `${(-y * 18).toFixed(1)}deg`);
    box.style.setProperty("--tx", (x * 14).toFixed(1));
  };
  const leave = () => ["--ry", "--rx", "--tx"].forEach((v) => el.current?.style.removeProperty(v));
  return (
    <span ref={el} className={`t3d ${tilt ? "t3d-tilt" : ""} ${className}`} style={{ "--tint": TIER_LOOK[kind].tint, ...style } as CSSProperties} onPointerMove={tilt ? move : undefined} onPointerLeave={tilt ? leave : undefined} aria-hidden>
      <span className="t3d-glow" />
      {photo ? (
        <span className="t3d-art t3d-photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- one fixed picture from public/career */}
          <img src={photo} alt="" draggable={false} />
        </span>
      ) : (
        <span className="t3d-art" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </span>
  );
}

/** The badge of a rank: a shield in the metal of the rank, with a chevron for each step. The world champion has a crown. */
export function RankBadge({ rank, className = "" }: { rank: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const look = RANK_LOOK[rank] ?? RANK_LOOK.Pubspiller;
  const html = useMemo(() => badgeSvg(look.metal, look.chevrons, !!look.crown, `b${id}_`), [look, id]);
  return <span className={`rank-badge ${className}`} aria-hidden dangerouslySetInnerHTML={{ __html: html }} style={{ "--rank": MATERIALS[look.metal].l } as CSSProperties} />;
}

/** A cup the player has won, as a card: a frame in the metal of the event, the cup, the name in foil, the date and the prize. It tilts under a finger. */
export function PokalCard({ kind, date, prize, name, variant }: { kind: TierId; date: string; prize: string; name: string; variant?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const box = el.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    box.style.setProperty("--ry", `${(x * 22).toFixed(1)}deg`);
    box.style.setProperty("--rx", `${(-y * 18).toFixed(1)}deg`);
  };
  const leave = () => ["--ry", "--rx"].forEach((v) => el.current?.style.removeProperty(v));
  return (
    <div ref={el} className="pokal" style={{ "--frame": frameOf(kind), "--tint": TIER_LOOK[kind].tint } as CSSProperties} onPointerMove={move} onPointerLeave={leave}>
      <span className="pokal-ribbon" aria-hidden>
        SEIER
      </span>
      <div className="pokal-in">
        <div style={{ width: "5rem" }}>
          <TrophyArt kind={kind} bare variant={variant} />
        </div>
        <span className="pokal-name foil foil-soft" data-t={name} style={foilVars(kind) as CSSProperties}>
          {name}
        </span>
        <span className="pokal-meta">
          <span>{date}</span>
          <b>{prize}</b>
        </span>
      </div>
    </div>
  );
}
