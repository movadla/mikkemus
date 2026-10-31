import { Fragment, useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import { careerSound } from "@/lib/uiSound";
import { cupColor } from "@/lib/botCup";
import { dollars, type Place } from "@/lib/career";
import { STAGE } from "@/lib/scenePalette";
import { matchParticipants, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { useRoster } from "@/lib/storage";
import { Avatar } from "./ui/Avatar";
import { ArrowLeftIcon, CoinIcon } from "./icons";
import { PlayButton } from "./PlayButton";
import { CupEmblem } from "./ui/CupEmblem";
import type { Me } from "./OpponentCard";
import { WalkOn } from "./show/WalkOn";
import { rankPlate, shouldWalkOn } from "./show/WalkOnLogic";
import { playerWorldRank, worldRankFor } from "@/lib/opponentStats";
import { opponentOf } from "@/lib/opponents";

/**
 * The moment before a final of the career: the room goes dark, a light finds the cup, and the two who are left walk in from either side
 * with FINALEN between them. It takes a few seconds and then waits for the button, so nobody is rushed into the match.
 */
export function FinalIntro({ tournament, match, prizes, me, onStart, onBack }: { tournament: Tournament; match: TournamentMatch; /** What the places pay, for the line under the cup. */ prizes?: Partial<Record<Place, number>>; /** Show: the player, for the walk-on (the character and the rank). Without it the walk-on uses the cup's human side and the first character. */ me?: Me; onStart: () => void; onBack?: () => void }) {
  const roster = useRoster();
  const { show } = useAccess();
  const [a, b] = matchParticipants(match);
  // Show: the walk-on comes first, once per visit of this screen; the crowd is then the walk-on's, and the final's own comes after it.
  const humans = [a, b].filter((n) => !tournament.participants.find((p) => p.name === n)?.isBot);
  const walker = me?.name && [a, b].includes(me.name) ? me.name : humans.length === 1 ? humans[0] : null;
  const [walking, setWalking] = useState(() => shouldWalkOn({ show, big: true, team: !!me?.members }) && !!walker);
  useEffect(() => {
    if (!walking) careerSound("crowd-2");
  }, [walking]);
  const colour = cupColor(tournament.cup?.kind);
  const side = (name: string) => {
    const p = tournament.participants.find((x) => x.name === name);
    return { name, bot: !!p?.isBot, photo: roster.find((r) => r.name === name)?.photo };
  };
  const left = side(a);
  const right = side(b);
  return (
    <div
      className="animate-screen-enter screen final-stage"
      style={{ "--cup": colour, background: `radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, ${colour} 38%, transparent), transparent 70%), linear-gradient(${STAGE.final.top}, ${STAGE.final.bottom})` } as React.CSSProperties}
    >
      <div className="final-beam" aria-hidden />
      <div className="screen-inner relative z-10 flex flex-col items-center text-center" style={{ minHeight: "88dvh", justifyContent: "center", gap: "1.2rem" }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Tilbake" className="tactile absolute top-0 left-0 inline-flex items-center justify-center" style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
        )}
        <div className="final-emblem" style={{ color: colour }}>
          <CupEmblem kind={tournament.cup?.kind ?? "lu"} className="w-14 h-14" />
        </div>
        <h1 className="font-display final-title" style={{ color: "var(--color-cream)", fontSize: "clamp(2.6rem, 14vw, 4.4rem)", lineHeight: 1, letterSpacing: "0.04em" }}>
          FINALEN
        </h1>
        {prizes?.winner ? (
          <span className="final-fade inline-flex items-center gap-2 tabular" style={{ "--d": "1.1s", padding: "0.35rem 0.9rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", border: "1px solid var(--color-gold)", color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-title)" } as React.CSSProperties}>
            <CoinIcon className="w-5 h-5" />
            {dollars(prizes.winner)}
          </span>
        ) : null}
        <div className="flex items-start justify-center gap-3 w-full">
          {[left, right].map((s, i) => (
            <Fragment key={s.name}>
              {i === 1 && (
                <span className="final-vs font-display" style={{ color: colour, fontSize: "var(--text-title)", paddingTop: "2.2rem" }} aria-hidden>
                  VS
                </span>
              )}
              <div className={i === 0 ? "final-left" : "final-right"} style={{ flex: "1 1 0", minWidth: 0 }}>
                <Avatar name={s.name} photo={s.photo} size="xl" bot={s.bot} state="active" />
                <p className="font-display truncate mt-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                  {s.name}
                </p>
              </div>
            </Fragment>
          ))}
        </div>
        <div className="w-full final-fade" style={{ "--d": "1.6s" } as React.CSSProperties}>
          <PlayButton label="KAST" onClick={onStart} />
        </div>
      </div>
      {walking && walker && (
        <WalkOn
          player={walker}
          character={me?.character}
          playerRank={me ? rankPlate(playerWorldRank(me.med, me.points)) : ""}
          opponent={walker === a ? b : a}
          opponentRank={rankPlate(worldRankFor(walker === a ? b : a, opponentOf(walker === a ? b : a).med))}
          colour={colour}
          onDone={() => setWalking(false)}
        />
      )}
    </div>
  );
}
