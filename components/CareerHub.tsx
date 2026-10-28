"use client";

import { useState } from "react";
import { DRILL_ROUNDS } from "@/lib/training";
import {
  GAMES,
  LADDER,
  SLOTS,
  buyPlace,
  buyUpgrade,
  dollars,
  isUnlocked,
  nextPlace,
  nextPrice,
  offerChallenge,
  stakeFor,
  startEvent,
  whyNot,
  whyNotBuy,
  whyNotMove,
  type Career,
  type GameId,
  type SlotId,
  type Tier,
} from "@/lib/career";
import { cupColor } from "@/lib/botCup";
import { rankOf, rankProgress, roomBadge } from "@/lib/careerGoals";
import { heroButton, heroFor } from "@/lib/careerHero";
import { uiFeedback } from "@/lib/uiSound";
import { levelLabel, newSeed, oneDecimal } from "./careerFormat";
import { ArenaIcon, HomeIcon, LockIcon, SlotIcon, StarIcon } from "./careerIcons";
import { CareerHud } from "./CareerHud";
import { CareerProfile } from "./CareerProfile";
import { markTipSeen, TipPointer, useTipSeen } from "./CareerTip";
import { ConfirmDialog } from "./ConfirmDialog";
import { HomeScene } from "./HomeScene";
import { BoltIcon, BullseyeIcon, CoinIcon, MoreIcon } from "./icons";
import { PlayButton } from "./PlayButton";
import { RoundButton } from "./RoundButton";
import { Button } from "./ui/Button";
import { CupEmblem } from "./ui/CupEmblem";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";

type View = "home" | "rooms" | "road" | "training" | "challenges";

const TITLE: Record<Exclude<View, "home">, string> = { rooms: "Rom", road: "Veien", training: "Trening", challenges: "Utfordring" };

/** The one goal on the home screen: the star the player is working towards, a bar, and the points. */
function GoalStrip({ career }: { career: Career }) {
  const g = rankProgress(career);
  if (!g) return null;
  return (
    <div className="goal-strip tabular" role="progressbar" aria-label={`Veien til nivå ${g.next}`} aria-valuemin={0} aria-valuemax={g.need} aria-valuenow={g.points}>
      <span className="inline-flex items-center gap-1" style={{ color: "var(--color-gold-strong)", fontWeight: 800 }}>
        <StarIcon className="w-4 h-4" />
        {g.next}
      </span>
      <span className="flex-1" style={{ height: "0.4rem", borderRadius: "var(--radius-pill)", background: "var(--color-cell)", overflow: "hidden" }}>
        <span className="block" style={{ width: `${Math.max(3, g.progress * 100)}%`, height: "100%", borderRadius: "var(--radius-pill)", background: "var(--color-gold)", transition: "width var(--pull)" }} />
      </span>
      <span style={{ color: "var(--color-text-2)", fontWeight: 700 }}>
        {g.points}/{g.need}
      </span>
    </div>
  );
}

/** The price as a button: teal when it can be bought, grey with a lock when it cannot yet, and a gold frame when there is no more to buy. */
function BuyButton({ price, off, full, onClick }: { price: number | null; off: boolean; full: boolean; onClick: () => void }) {
  if (full || price === null) return <span className="buy-btn buy-btn-full">Full</span>;
  return (
    <button type="button" onClick={onClick} disabled={off} className={`buy-btn tactile ${off ? "buy-btn-off" : ""} ${FOCUS_RING}`}>
      {off && <LockIcon className="w-3.5 h-3.5" />}
      {dollars(price)}
    </button>
  );
}

/** The home of a career, made as simple as it goes: the room, one big button, four round ones. Everything else is behind one of them. */
export function Hub({ career, onBack, onPlay, onChallenge, onTrain, commit, onDelete }: { career: Career; onBack: () => void; onPlay: () => void; onChallenge: () => void; onTrain: () => void; commit: (c: Career) => void; onDelete: () => void }) {
  const [view, setView] = useState<View>("home");
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The thing just bought flashes in the picture for a moment.
  const [pop, setPop] = useState<SlotId | null>(null);
  // The step of the road that is picked (the one that is going, or the one the main button leads to).
  const hero = heroFor(career);
  const [picked, setPicked] = useState<Tier["id"] | null>(null);
  const playTip = useTipSeen("play");
  const go = (v: View) => {
    uiFeedback("pick");
    setView(v);
  };
  const press = () => {
    uiFeedback("click");
    markTipSeen("play");
    if (hero.kind === "enter") {
      commit(startEvent(career, hero.tier.id, newSeed()));
      onPlay();
    } else if (hero.kind === "event") onPlay();
    else onChallenge();
  };
  const button = heroButton(hero);
  // Something beyond the pub is open and has not been entered: the road button says so.
  const roadDot = !career.active && !career.challenge && LADDER.some((t) => t.id !== "lu" && whyNot(career, t) === null);
  const buy = (fn: () => Career, slot: SlotId) => {
    uiFeedback("confirm");
    commit(fn());
    setPop(slot);
    setTimeout(() => setPop(null), 1500);
  };

  const menuButton = (
    <button type="button" onClick={() => setMenu(true)} aria-label="Meny" className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`} style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-pill)", background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}>
      <MoreIcon className="w-5 h-5" />
    </button>
  );

  const sheets = (
    <>
      {menu && (
        <Sheet title="Karriere" onClose={() => setMenu(false)}>
          <div className="space-y-2">
            <Button
              block
              onClick={() => {
                setMenu(false);
                setProfile(true);
              }}
            >
              Profil
            </Button>
            <Button block onClick={onBack}>
              Alle karrierer
            </Button>
            <Button
              block
              variant="ghost"
              onClick={() => {
                setMenu(false);
                setConfirmDelete(true);
              }}
            >
              <span style={{ color: "var(--color-red)" }}>Slett karrieren</span>
            </Button>
          </div>
        </Sheet>
      )}
      {profile && (
        <Sheet title="Profil" onClose={() => setProfile(false)}>
          <CareerProfile career={career} />
        </Sheet>
      )}
      {confirmDelete && (
        <ConfirmDialog
          message={`Slette karrieren til ${career.player}? Saldo, pokaler og alt du har kjøpt er borte.`}
          buttons={[
            { label: "Behold", onClick: () => setConfirmDelete(false), background: "var(--color-green)" },
            { label: "Slett karriere", onClick: onDelete, background: "var(--color-red)" },
          ]}
        />
      )}
    </>
  );

  if (view === "home") {
    return (
      <div className="animate-screen-push screen career-skin">
        {sheets}
        <div className="screen-inner career-home">
          <CareerHud career={career} end={menuButton} />
          <GoalStrip career={career} />
          <div className="career-home-room">
            <div className="text-center">
              <p className="font-display" style={{ fontSize: "var(--text-num)", lineHeight: 1.05, color: "var(--color-cream)" }}>
                {career.player}
              </p>
              <p style={{ color: "var(--color-gold-strong)", fontWeight: 700, fontSize: "var(--text-small)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{rankOf(career)}</p>
            </div>
            <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} />
          </div>
          <div className="relative">
            {!playTip && <TipPointer id="play" label="Trykk her" />}
            <PlayButton label={button.label} sub={button.sub} tone={hero.kind === "event" && hero.done ? "gold" : hero.kind === "challenge" && hero.done && hero.challenge.won ? "gold" : "teal"} onClick={press} />
          </div>
          <div className="round4">
            <RoundButton icon={<HomeIcon />} label="Rom" badge={roomBadge(career)} onClick={() => go("rooms")} />
            <RoundButton icon={<BullseyeIcon />} label="Trening" onClick={() => go("training")} />
            <RoundButton icon={<BoltIcon />} label="Utfordring" onClick={() => go("challenges")} />
            <RoundButton icon={<ArenaIcon />} label="Veien" badge={roadDot} onClick={() => go("road")} />
          </div>
        </div>
      </div>
    );
  }

  const selected = LADDER.find((t) => t.id === (picked ?? (hero.kind === "challenge" ? "lu" : hero.tier.id))) ?? LADDER[0];
  const selWhy = career.active?.tier === selected.id ? null : whyNot(career, selected);
  const selState = career.active?.tier === selected.id ? "active" : !isUnlocked(career, selected) ? "locked" : selWhy ? "short" : "open";

  return (
    <div className="animate-screen-push screen career-skin" style={{ paddingBottom: "1rem" }}>
      {sheets}
      <div className="screen-inner flex flex-col gap-3" style={{ minHeight: "calc(100dvh - 2rem)" }}>
        <CareerHud career={career} onBack={() => setView("home")} title={TITLE[view]} />

        {view === "rooms" && (
          <>
            <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} pop={pop} compact />
            {nextPlace(career) && (
              <div className="room-tile room-tile-wide">
                <span className="room-tile-ico">
                  <ArenaIcon />
                </span>
                <b className="flex-1 min-w-0 truncate">{nextPlace(career)!.name}</b>
                <BuyButton price={nextPlace(career)!.price} off={!!whyNotMove(career)} full={false} onClick={() => buy(() => buyPlace(career), "wall")} />
              </div>
            )}
            <ul className="grid grid-cols-2 gap-2" aria-label="Rom">
              {SLOTS.map((slot) => {
                const step = career.arena[slot.id];
                const price = nextPrice(career, slot.id);
                return (
                  <li key={slot.id} className="room-tile">
                    <span className="room-tile-ico">
                      <SlotIcon id={slot.id} />
                    </span>
                    <b>{slot.name}</b>
                    <span className="pips" role="img" aria-label={`${step} av 3`}>
                      {[0, 1, 2].map((i) => (
                        <i key={i} className={i < step ? "on" : ""} />
                      ))}
                    </span>
                    <BuyButton price={price} off={!!whyNotBuy(career, slot.id)} full={price === null} onClick={() => buy(() => buyUpgrade(career, slot.id), slot.id)} />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {view === "road" && (
          <>
            <ol className="career-road" aria-label="Veien til VM">
              {[...LADDER].reverse().map((tier) => {
                const locked = !isUnlocked(career, tier);
                const here = career.active?.tier === tier.id;
                const colour = cupColor(tier.kind);
                return (
                  <li key={tier.id} className="career-road-node" data-state={locked ? "locked" : "open"}>
                    <button type="button" onClick={() => setPicked(tier.id)} aria-pressed={selected.id === tier.id} className={`road-row tactile ${selected.id === tier.id ? "road-row-on" : ""} ${FOCUS_RING}`} style={{ "--cup": colour } as React.CSSProperties}>
                      <span className="career-road-dot" style={{ borderColor: locked ? "var(--color-border)" : colour, color: locked ? "var(--color-muted)" : colour, boxShadow: here ? `0 0 0 5px color-mix(in srgb, ${colour} 25%, transparent)` : "none" }} aria-hidden>
                        {locked ? <LockIcon className="w-5 h-5" /> : <CupEmblem kind={tier.kind} className="w-6 h-6" />}
                      </span>
                      <b className="font-display flex-1 min-w-0 truncate" style={{ fontSize: "var(--text-title)", color: locked ? "var(--color-text-2)" : "var(--color-cream)" }}>
                        {tier.short}
                      </b>
                      <span className="tabular" style={{ color: locked ? "var(--color-muted)" : "var(--color-gold-strong)", fontWeight: 800 }}>
                        {dollars(tier.prizes.winner ?? 0)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-auto">
              <PlayButton
                label="SPILL"
                sub={selState === "active" ? "Fortsett" : selState === "locked" ? selected.qualify : selState === "short" ? selWhy ?? undefined : selected.fee === 0 ? "gratis" : dollars(selected.fee)}
                disabled={selState === "locked" || selState === "short"}
                onClick={() => {
                  uiFeedback("click");
                  if (selState === "active") onPlay();
                  else {
                    commit(startEvent(career, selected.id, newSeed()));
                    onPlay();
                  }
                }}
              />
            </div>
          </>
        )}

        {view === "training" && (
          <>
            <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} compact />
            <div className="room-tile room-tile-wide" style={{ display: "grid", justifyItems: "center", gap: "0.15rem", padding: "1rem" }}>
              <span className="section-label">NIVÅ</span>
              <b className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
                {levelLabel(career.skillMed)}
              </b>
              <span className="tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
                {oneDecimal(career.skillMed)} mm{career.training[0] ? ` · sist ${oneDecimal(career.training[0].average)}` : ""}
              </span>
            </div>
            <div className="mt-auto">
              <PlayButton label="START" sub={`${DRILL_ROUNDS} runder · trebling 20`} onClick={onTrain} />
            </div>
          </>
        )}

        {view === "challenges" && (
          <>
            <HomeScene home={career.profile.home} arena={career.arena} trophies={career.trophies} compact />
            <ul className="mt-auto space-y-2" aria-label="Utfordringer">
              {(Object.keys(GAMES) as GameId[]).map((game) => {
                const shut = !!career.active || !!career.challenge;
                return (
                  <li key={game}>
                    <button
                      type="button"
                      disabled={shut}
                      className={`pick-row tactile ${FOCUS_RING}`}
                      onClick={() => {
                        uiFeedback("click");
                        commit(offerChallenge(career, game, newSeed()));
                        onChallenge();
                      }}
                    >
                      <b className="font-display flex-1 text-left" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
                        {GAMES[game].name}
                      </b>
                      <span className="inline-flex items-center gap-1.5 tabular" style={{ color: "var(--color-gold-strong)", fontWeight: 800, fontSize: "var(--text-title)" }}>
                        <CoinIcon className="w-5 h-5" />
                        {dollars(stakeFor(career, game))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
