"use client";

import { cupColor } from "@/lib/botCup";
import { GAMES, TIERS, dollars, type Tier } from "@/lib/career";
import { heroCta, type Hero } from "@/lib/careerHero";
import { GROUND } from "./EventIntro";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";
import { BoltIcon } from "./icons";

/** The line of money chips: what the winner gets, and the second place. */
function Prizes({ tier }: { tier: Tier }) {
  const chip = { padding: "0.15rem 0.6rem", borderRadius: "var(--radius-pill)", background: "var(--gold-soft)", color: "var(--color-gold-strong)", border: "1px solid var(--color-gold)", fontSize: "var(--text-small)", fontWeight: 700 } as const;
  return (
    <p className="flex gap-2 flex-wrap">
      <span style={chip}>Vinner {dollars(tier.prizes.winner ?? 0)}</span>
      {tier.prizes.final ? <span style={chip}>2.: {dollars(tier.prizes.final)}</span> : null}
    </p>
  );
}

/**
 * The one big thing on the home screen: the tournament to play next, in its own colours and light, with what it pays and one button that says
 * what happens when it is pressed. A cup that is going says where it stands; a challenge that is on takes the same place. Everything else on
 * the screen is smaller than this, on purpose.
 */
export function CareerHero({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const tier = hero.kind === "challenge" ? null : hero.tier;
  const challenge = hero.kind === "challenge" ? hero.challenge : null;
  const [top, bottom] = tier ? GROUND[tier.id] : [GROUND.lu[0], GROUND.vm[1]];
  const colour = tier ? cupColor(tier.kind) : "var(--color-teal)";
  const going = hero.kind === "event";
  const eyebrow = hero.kind === "challenge" ? (hero.done ? "UTFORDRING FERDIG" : "UTFORDRING PÅGÅR") : going ? (hero.done ? "FERDIG SPILT" : "PÅGÅR") : "NESTE TURNERING";
  return (
    <section aria-label={eyebrow} className="career-hero relative overflow-hidden" style={{ "--cup": colour, borderRadius: "var(--radius-l)", padding: "1.1rem", background: `linear-gradient(165deg, ${top}, ${bottom})`, border: `1px solid ${colour}`, boxShadow: "var(--elevation-2)" } as React.CSSProperties}>
      {tier && tier.scale >= 3 && <div className="intro-beams" aria-hidden />}
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span style={{ color: colour }} className="shrink-0">
            {tier ? <CupEmblem kind={tier.kind} className="w-12 h-12" /> : <BoltIcon className="w-12 h-12" />}
          </span>
          <div className="min-w-0">
            <p className="section-label" style={{ color: colour }}>
              {eyebrow}
            </p>
            <h2 className="font-display" style={{ fontSize: "var(--text-num)", lineHeight: 1.05, color: "var(--color-cream)" }}>
              {tier ? tier.name : `${GAMES[challenge!.game].name} mot ${challenge!.opponent.name}`}
            </h2>
          </div>
        </div>
        {tier ? (
          <>
            <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
              {tier.venue} · {tier.size} spillere · ca. {tier.minutes} min · {tier.fee === 0 ? "gratis inngang" : `inngang ${dollars(tier.fee)}`}
            </p>
            <Prizes tier={tier} />
          </>
        ) : (
          <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)" }}>
            {GAMES[challenge!.game].about} · innsats <span style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>{dollars(challenge!.stake)}</span>
          </p>
        )}
        <Button block variant="primary" size="lg" onClick={onPress}>
          {heroCta(hero)}
        </Button>
        {hero.kind === "enter" && hero.tier.id !== "lu" && (
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Du kan alltid spille {TIERS.lu.name} gratis i stedet.</p>
        )}
      </div>
    </section>
  );
}
