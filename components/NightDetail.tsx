"use client";

import { useMemo, useState } from "react";
import { nightSlides } from "@/lib/nightStory";
import { NightStory } from "./NightStory";
import { dayLabel, isoDay } from "@/lib/formatDate";
import { formatNightDate, nightAverages, type NightSummary } from "@/lib/nights";
import { MedalIcon, TrophyIcon } from "@/components/icons";
import { ScreenTop } from "./ScreenTop";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Row } from "./ui/Row";
import { Section } from "./ui/Section";

/**
 * Shared rendering for both /kveld (latest night) and /kveld/[dato] (a specific, shareable
 * date) — the two routes only differ in how they pick `night` out of groupNights(), see there.
 */
const PLACE_COLOR = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

export function NightDetail({ night, otherDates }: { night: NightSummary | null; otherDates: string[] }) {
  const [story, setStory] = useState(false);
  const slides = useMemo(() => (night ? nightSlides(night) : []), [night]);
  const winner = night?.players[0];
  return (
    <div className="animate-screen-push screen">
      <div className="screen-inner">
        <ScreenTop title={night ? formatNightDate(night.date) : "Kveld"} backHref="/hall-of-fame" />
        {night && (
          <p className="tabular -mt-2 mb-4" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            {isoDay(night.date)}
          </p>
        )}

        {!night ? (
          <EmptyState title="Ingen kamper denne kvelden" />
        ) : (
          <>
            {winner && winner.wins > 0 && (
              <Card level="gold" className="mb-4 text-center">
                <p className="font-display" style={{ color: "var(--color-bg)", fontStyle: "italic", fontSize: "var(--text-body)" }}>
                  Kveldens vinner
                </p>
                <p className="font-display flex items-center justify-center gap-2" style={{ color: "var(--color-bg)", fontSize: "var(--text-num)" }}>
                  <TrophyIcon className="w-6 h-6" />
                  {winner.name}
                </p>
              </Card>
            )}

            {slides.length > 0 && (
              <div className="mb-4">
                <Button variant="primary" size="lg" block onClick={() => setStory(true)}>
                  Se kveldens oppsummering
                </Button>
              </div>
            )}
            {story && <NightStory slides={slides} onClose={() => setStory(false)} />}

            <Section label="Stilling">
              <div className="space-y-2">
                {night.players.map((p, i) => {
                  const stats = nightAverages(p);
                  return (
                    <Row
                      key={p.name}
                      leading={
                        <span className="inline-flex items-center gap-2">
                          {i < 3 && p.wins > 0 && (
                            <span style={{ color: PLACE_COLOR[i] }}>
                              <MedalIcon className="w-5 h-5" />
                            </span>
                          )}
                          <Avatar name={p.name} size="s" state={i === 0 && p.wins > 0 ? "winner" : "idle"} />
                        </span>
                      }
                      title={p.name}
                      subtitle={`${p.wins}–${p.losses}`}
                      value={stats.hitPct !== null ? `${Math.round(stats.hitPct)} %` : "–"}
                      tone={i === 0 && p.wins > 0 ? "gold" : "default"}
                    />
                  );
                })}
              </div>
            </Section>
          </>
        )}

        {otherDates.length > 0 && (
          <Section label="Andre kvelder">
            <div className="space-y-2">
              {otherDates.map((d) => (
                <Row key={d} href={`/kveld/${d}`} title={dayLabel(d)} subtitle={isoDay(d)} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
