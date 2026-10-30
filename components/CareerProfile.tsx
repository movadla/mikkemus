"use client";

import { useState } from "react";
import { PLACE_LABEL, TIERS, dollars, type Career } from "@/lib/career";
import { nextRank, rankOf } from "@/lib/careerGoals";
import { lifeOf, rivalOf, seasonOf, sponsorLogo, weekInSeason, REP_MAX, WEEKS_PER_SEASON } from "@/lib/careerLife";
import { PokalCard, RankBadge } from "./CareerTrophy";
import { CharacterFace } from "./CharacterFigure";
import { TrophyCabinet } from "./TrophyCabinet";
import { RankingList } from "./RankingList";
import { OpponentPortrait } from "./OpponentCard";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { CheckIcon } from "./icons";
import { LY_REGULARS } from "@/lib/opponents";
import { chooseRival, challengeRival } from "@/lib/careerWorld";
import { bestResults, meritsOf } from "@/lib/merits";
import { statsOf } from "@/lib/careerStats";
import { FOCUS_RING } from "./ui/focus";
import type { Place } from "@/lib/career";

/** A place in a tournament, in a word for the list of the last results. */
const RESULT_WORD: Record<Place, string> = { winner: "Vinner", final: "Finale", semi: "Semifinale", quarter: "Kvartfinale", r16: "8-delsfinale", r32: "Første runde" };

/** One number with its name under it. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center" style={{ padding: "0.5rem 0.25rem", borderRadius: "var(--radius-m)", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <span className="num block tabular" style={{ fontSize: "var(--text-title)", color: "var(--color-cream)" }}>
        {value}
      </span>
      <span style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>{label}</span>
    </div>
  );
}

export type ProfileTab = "oversikt" | "sesonger" | "pokaler" | "rangering";
const TABS: { id: ProfileTab; label: string }[] = [
  { id: "oversikt", label: "Oversikt" },
  { id: "sesonger", label: "Sesonger" },
  { id: "pokaler", label: "Pokaler" },
  { id: "rangering", label: "Rangering" },
];

/**
 * Who the player is in the career: the face in a ring that fills towards the next title, and three tabs: the overview (the numbers of the
 * career, the rival, the sponsor), the seasons with the last tournaments, and the cups, in the cabinet and as cards.
 */
export function CareerProfile({ career, tab: first = "oversikt", commit, onChallenge }: { career: Career; tab?: ProfileTab; commit?: (c: Career) => void; /** Goes to the duel when the rival has been challenged. */ onChallenge?: () => void }) {
  const [tab, setTab] = useState<ProfileTab>(first);
  const [rivalSheet, setRivalSheet] = useState<"rival" | "pick" | "merits" | null>(null);
  const next = nextRank(career);
  const life = lifeOf(career);
  const rival = rivalOf(career);
  const rec = career.rivals?.[rival.name];
  const metRival = !!rec && rec.w + rec.l > 0;
  const merits = meritsOf(career);
  const best = bestResults(career);
  // The last three tournaments (not the duels), newest first.
  const recent = career.history.filter((h) => !h.game).slice(0, 3);
  const stats = statsOf(career);
  const progress = next ? Math.min(1, career.points / next.min) : 1;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span
          className="pf-ring"
          role={next ? "progressbar" : undefined}
          aria-label={next ? `Neste rang: ${next.name}` : undefined}
          aria-valuemin={next ? 0 : undefined}
          aria-valuemax={next ? next.min : undefined}
          aria-valuenow={next ? career.points : undefined}
          style={{ "--p": `${Math.round(progress * 100)}%` } as React.CSSProperties}
        >
          <CharacterFace id={career.profile.character} px={76} />
        </span>
        <div className="min-w-0">
          <p className="font-display truncate" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)", lineHeight: 1.05 }}>
            {career.player}
          </p>
          <p className="rank-line" style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>
            <RankBadge rank={rankOf(career)} />
            {rankOf(career)}
          </p>
          {next && (
            <p className="tabular" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
              {career.points} av {next.min} poeng til {next.name}
              {life.seasonPts > 0 ? ` · ${life.seasonPts} denne sesongen` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="pf-tabs" role="tablist" aria-label="Profil">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`pf-tab tactile ${FOCUS_RING}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "oversikt" && (
        <div className="space-y-4" role="tabpanel" aria-label="Oversikt">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Turneringer" value={String(career.played)} />
            <Stat label="Titler" value={String(career.titles)} />
          </div>
          <dl className="pf-card">
            <div className="pf-row">
              <dt>Sesong</dt>
              <dd className="pf-season">
                {seasonOf(life.week)}
                <span className="season-ticks" role="img" aria-label={`Uke ${weekInSeason(life.week)} av ${WEEKS_PER_SEASON}`}>
                  {Array.from({ length: WEEKS_PER_SEASON }, (_, i) => (
                    <i key={i} className={i < weekInSeason(life.week) ? "on" : ""} />
                  ))}
                </span>
              </dd>
            </div>
            <div className="pf-row">
              <dt>Rival</dt>
              <dd>
                {metRival || life.rivalPick ? (
                  <button type="button" className={`pf-rival tactile ${FOCUS_RING}`} onClick={() => setRivalSheet("rival")}>
                    <span className="pf-rival-face">
                      <OpponentPortrait name={rival.name} />
                    </span>
                    <span>
                      {rival.name}
                      {metRival && (
                        <small>
                          {rec!.w}–{rec!.l}
                        </small>
                      )}
                    </span>
                  </button>
                ) : (
                  <Button onClick={() => setRivalSheet("pick")}>Velg rival</Button>
                )}
              </dd>
            </div>
            {life.sponsor && (
              <div className="pf-row">
                <dt>Sponsor</dt>
                <dd className="pf-sponsor">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sponsorLogo(life.sponsor.name)} alt="" className="sponsor-logo" width={44} height={44} draggable={false} />
                  <span>
                    {life.sponsor.name}
                    <small>{life.sponsor.left} turneringer igjen</small>
                  </span>
                </dd>
              </div>
            )}
            <div className="pf-row">
              <dt>Treningsrom</dt>
              <dd>Nivå {career.room + 1}</dd>
            </div>
            {/* The name: what saying no to a challenge costs, and what brings sponsors. It is spoken of under the challenges, so it is shown. */}
            <div className="pf-row">
              <dt>Rykte</dt>
              <dd>
                <span className="season-ticks" role="img" aria-label={`Rykte ${life.reputation} av ${REP_MAX}`}>
                  {Array.from({ length: REP_MAX }, (_, i) => (
                    <i key={i} className={i < life.reputation ? "on" : ""} />
                  ))}
                </span>
              </dd>
            </div>
            <div className="pf-row">
              <dt>Meritter</dt>
              <dd>
                <button type="button" className={`pf-link tactile ${FOCUS_RING}`} onClick={() => setRivalSheet("merits")}>
                  {best.length > 0 ? `${best[0].name}: ${best[0].best}` : "Ingen ennå"} ›
                </button>
              </dd>
            </div>
          </dl>
          {stats.matches > 0 && (
            <div className="pf-recent">
              <p className="section-label">STATISTIKK</p>
              <ul className="pf-stats" aria-label="Statistikk">
                <li>
                  <b className="tabular">
                    {stats.won} av {stats.matches}
                  </b>
                  <small>Kamper vunnet</small>
                </li>
                {stats.countdown && (
                  <>
                    <li>
                      <b className="tabular">{stats.countdown.average.toLocaleString("nb-NO")}</b>
                      <small>Snitt, siste 10</small>
                    </li>
                    <li>
                      <b className="tabular">{stats.countdown.best}</b>
                      <small>Beste runde</small>
                    </li>
                    <li>
                      <b className="tabular">{stats.countdown.max180}</b>
                      <small>180</small>
                    </li>
                    <li>
                      <b className="tabular">{stats.countdown.checkout || "–"}</b>
                      <small>Høyeste utsjekk</small>
                    </li>
                  </>
                )}
                {stats.mm && (
                  <>
                    <li>
                      <b className="tabular">{stats.mm.hitRate} %</b>
                      <small>Treff</small>
                    </li>
                    <li>
                      <b className="tabular">{stats.mm.darts}</b>
                      <small>Piler per kamp</small>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
          {recent.length > 0 && (
            <div className="pf-recent">
              <p className="section-label">SISTE RESULTATER</p>
              <ul aria-label="Siste resultater">
                {recent.map((h, i) => (
                  <li key={`${h.at}-${i}`}>
                    <span className="min-w-0 truncate">{h.event}</span>
                    <b className="tabular">
                      {h.place ? RESULT_WORD[h.place] : ""}
                      {h.prize > 0 ? ` · ${dollars(h.prize)}` : ""}
                    </b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "sesonger" && (
        <div className="space-y-4" role="tabpanel" aria-label="Sesonger">
          {life.seasons.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Ingen avsluttede sesonger ennå</p>
          ) : (
            <ul className="pf-list">
              {life.seasons.slice(0, 8).map((s) => (
                <li key={s.season} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                  <span>
                    Sesong {s.season} · nr. {s.rank}
                    {s.rank === 1 ? " · årets spiller" : ` · vinner ${s.winner}`}
                  </span>
                  <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                    {s.prize > 0 ? `+${dollars(s.prize)}` : "ingen premie"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {career.history.length > 0 && (
            <>
              <p className="section-label">SISTE TURNERINGER</p>
              <ul className="pf-list">
                {career.history.slice(0, 8).map((h) => (
                  <li key={h.at} className="flex items-baseline justify-between gap-3" style={{ fontSize: "var(--text-small)", color: "var(--color-text-2)" }}>
                    <span>{h.place ? `${h.event} · ${PLACE_LABEL[h.place]}` : `${h.event} · ${h.won ? "vant" : "tapt"}`}</span>
                    <span className="tabular shrink-0" style={{ color: "var(--color-muted)" }}>
                      {h.prize - h.cost > 0 ? "+" : ""}
                      {dollars(h.prize - h.cost)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {rivalSheet === "rival" && (
        <Sheet title={rival.name} onClose={() => setRivalSheet(null)}>
          <div className="space-y-3">
            <div className="pf-rival-big">
              <OpponentPortrait name={rival.name} />
            </div>
            <p style={{ color: "var(--color-text-2)", textAlign: "center" }}>
              {rival.style}
              {metRival ? ` · ${rec!.w}–${rec!.l}` : ""}
            </p>
            <Button
              block
              variant="primary"
              disabled={!!career.active || !!career.challenge}
              onClick={() => {
                setRivalSheet(null);
                commit?.(challengeRival(career, Math.floor(Math.random() * 2 ** 31)));
                onChallenge?.();
              }}
            >
              Utfordre til duell
            </Button>
            {(career.active || career.challenge) && (
              <p className="info-line" style={{ paddingInline: 0, textAlign: "center" }}>
                Fullfør det som pågår først
              </p>
            )}
            <Button block onClick={() => setRivalSheet("pick")}>
              Bytt rival
            </Button>
          </div>
        </Sheet>
      )}
      {rivalSheet === "pick" && (
        <Sheet title="Velg rival" onClose={() => setRivalSheet(null)}>
          <ul className="pf-pick">
            {LY_REGULARS.filter((r) => r.name.toLowerCase() !== career.player.trim().toLowerCase() && !life.world.retired.includes(r.name)).map((r) => (
              <li key={r.name}>
                <button
                  type="button"
                  className={`pf-pick-row tactile ${FOCUS_RING}`}
                  aria-pressed={r.name === rival.name && !!life.rivalPick}
                  onClick={() => {
                    commit?.(chooseRival(career, r.name));
                    setRivalSheet(null);
                  }}
                >
                  <span className="pf-rival-face">
                    <OpponentPortrait name={r.name} />
                  </span>
                  <b>{r.name}</b>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {rivalSheet === "merits" && (
        <Sheet title={`Meritter · ${merits.filter((m) => m.done).length} av ${merits.length}`} onClose={() => setRivalSheet(null)}>
          {best.length > 0 && (
            <ul className="pf-merits pf-best" aria-label="Beste resultat">
              {best.map((b) => (
                <li key={b.id} className="done">
                  <span className="min-w-0">
                    <b>{b.name}</b>
                    <small>Best: {b.best}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ul className="pf-merits">
            {merits.map((m) => (
              <li key={m.id} className={m.done ? "done" : ""}>
                <span aria-hidden className="pf-merit-mark">
                  {m.done ? <CheckIcon className="w-4 h-4" /> : null}
                </span>
                <span className="min-w-0">
                  <b>{m.name}</b>
                  <small>{m.about}</small>
                </span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {tab === "rangering" && (
        <div role="tabpanel" aria-label="Rangering">
          <RankingList career={career} />
        </div>
      )}

      {tab === "pokaler" && (
        <div className="space-y-4" role="tabpanel" aria-label="Pokaler">
          <TrophyCabinet career={career} />
          {career.trophies.length === 0 ? null : (
            <ul className="grid grid-cols-2 gap-3">
              {career.trophies.map((t) => (
                <li key={t.at}>
                  <PokalCard kind={t.tier} name={t.name ?? TIERS[t.tier].trophy} variant={t.name} date={t.at.slice(0, 10)} prize={dollars(t.prize)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
