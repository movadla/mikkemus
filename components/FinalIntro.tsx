import { cupColor } from "@/lib/botCup";
import { STAGE } from "@/lib/scenePalette";
import { matchParticipants, type Tournament, type TournamentMatch } from "@/lib/tournament";
import { useRoster } from "@/lib/storage";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";

/**
 * The moment before a final of the career: the room goes dark, a light finds the cup, and the two who are left walk in from either side
 * with FINALEN between them. It takes a few seconds and then waits for the button, so nobody is rushed into the match.
 */
export function FinalIntro({ tournament, match, onStart }: { tournament: Tournament; match: TournamentMatch; onStart: () => void }) {
  const roster = useRoster();
  const [a, b] = matchParticipants(match);
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
        <div className="final-emblem" style={{ color: colour }}>
          <CupEmblem kind={tournament.cup?.kind ?? "lu"} className="w-14 h-14" />
        </div>
        <h1 className="font-display final-title" style={{ color: "var(--color-cream)", fontSize: "clamp(2.6rem, 14vw, 4.4rem)", lineHeight: 1, letterSpacing: "0.04em" }}>
          FINALEN
        </h1>
        <p className="final-fade" style={{ "--d": "1.1s", color: colour, fontWeight: 600 } as React.CSSProperties}>
          {tournament.cup?.trophy ?? tournament.name}
        </p>
        <div className="flex items-center justify-center gap-3 w-full">
          {[left, right].map((s, i) => (
            <div key={s.name} className={i === 0 ? "final-left" : "final-right"} style={{ flex: "1 1 0", minWidth: 0 }}>
              <Avatar name={s.name} photo={s.photo} size="xl" bot={s.bot} state="active" />
              <p className="font-display truncate mt-2" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)" }}>
                {s.name}
              </p>
            </div>
          ))}
          <span className="final-vs font-display" style={{ color: colour, fontSize: "var(--text-title)" }} aria-hidden>
            VS
          </span>
        </div>
        <div className="w-full final-fade" style={{ "--d": "1.6s" } as React.CSSProperties}>
          <Button block variant="primary" size="lg" onClick={onStart}>
            Start finalen
          </Button>
        </div>
      </div>
    </div>
  );
}
