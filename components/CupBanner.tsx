import type { CupKind } from "@/lib/botCup";
import { cupColor, type CupConfig } from "@/lib/botCup";
import type { TierId } from "@/lib/career";
import { TIER_LOOK, foilVars } from "@/lib/materials";
import { TrophyArt } from "./CareerTrophy";

/** The step of the career a cup stands on, for its trophy and its metal (a European championship is a Grand Slam in looks). */
const TIER_OF: Record<CupKind, TierId> = { vm: "vm", em: "gs", gs: "gs", nm: "nm", open: "lu", lu: "lu", region: "region" };

/**
 * The title card of a cup, the same on the draw, the overview and the big screen: its trophy (the photographed one where there is one) standing
 * a little out of the card, its name in the metal of the cup, and the trophy it is played for, on a stripe in the colour of the cup.
 * A tournament that is not a cup has none.
 */
export function CupBanner({ cup, name, large = false }: { cup: Pick<CupConfig, "kind" | "name" | "trophy">; name?: string; large?: boolean }) {
  const colour = cupColor(cup.kind);
  const tier = TIER_OF[cup.kind];
  const title = name || cup.name;
  return (
    <div className={`cup-banner ${large ? "cup-banner-large" : ""}`} style={{ "--cup": colour, "--tint": TIER_LOOK[tier].tint } as React.CSSProperties}>
      <span className="cup-banner-trophy" aria-hidden>
        <TrophyArt kind={tier} bare />
      </span>
      <div className="min-w-0">
        <p className="cup-banner-name font-display truncate">
          <span className="foil" data-t={title} style={foilVars(tier) as React.CSSProperties}>
            {title}
          </span>
        </p>
        <p className="cup-banner-sub truncate">{cup.trophy}</p>
      </div>
    </div>
  );
}
