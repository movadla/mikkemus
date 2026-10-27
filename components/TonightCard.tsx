"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccess } from "@/lib/access";
import { dayLabel, whenLabel } from "@/lib/formatDate";
import { buildMatchLog } from "@/lib/matchLog";
import { groupNights } from "@/lib/nights";
import { plainName } from "@/lib/botLevels";
import { buildSeedTable } from "@/lib/seedingTable";
import { useRoster } from "@/lib/storage";
import { MedalIcon } from "./icons";
import { Avatar } from "./ui/Avatar";
import { CountUp } from "./ui/CountUp";
import { Row } from "./ui/Row";
import { Section } from "./ui/Section";

const RULES = { target: 3, ringChoice: true };
const PLACE_COLOR = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

/**
 * What the front page says about the evening: the top three of the last night with their wins and losses, the match played last
 * with who won it, and who stands first in the seeding. All of it from what is already recorded; nothing for the limited code,
 * which does not see statistics.
 */
export function TonightCard() {
  const roster = useRoster();
  const { limited } = useAccess();
  const night = useMemo(() => groupNights(roster)[0], [roster]);
  const last = useMemo(() => buildMatchLog(roster)[0], [roster]);
  const first = useMemo(() => buildSeedTable(roster, RULES)[0], [roster]);

  if (limited || (!night && !last)) return null;
  const top = night?.players.filter((p) => p.wins + p.losses > 0).slice(0, 3) ?? [];
  return (
    <div className="wide-columns">
      {night && top.length > 0 && (
        <Section label={`Stilling · ${dayLabel(night.date)}`} aside={<Link href={`/kveld/${night.date}`} className="underline" style={{ color: "var(--color-teal)", fontSize: "var(--text-small)" }}>Hele kvelden</Link>}>
          <div className="space-y-2 stagger">
            {top.map((p, i) => {
              const record = roster.find((r) => r.name === p.name);
              return (
                <Row
                  key={p.name}
                  leading={
                    <span className="inline-flex items-center gap-2">
                      <span style={{ color: PLACE_COLOR[i] }}>
                        <MedalIcon className="w-5 h-5" />
                      </span>
                      <Avatar name={p.name} photo={record?.photo} size="s" state={i === 0 && p.wins > 0 ? "winner" : "idle"} />
                    </span>
                  }
                  title={p.name}
                  value={`${p.wins}–${p.losses}`}
                  bigValue
                  tone={i === 0 && p.wins > 0 ? "gold" : "default"}
                />
              );
            })}
          </div>
        </Section>
      )}
      {last && (
        <Section label="Sist spilt">
          <Row
            href={`/kamp/${encodeURIComponent(last.id)}`}
            title={last.sides.map((s) => plainName(s.name)).join(" mot ")}
            subtitle={whenLabel(last.date)}
            value={last.winner ? `${plainName(last.winner)} vant` : undefined}
          />
        </Section>
      )}
      {first && (
        <Section label="Nummer 1">
          <Row href={`/spillere/${encodeURIComponent(first.name)}`} tone="gold" leading={<Avatar name={first.name} photo={roster.find((r) => r.name === first.name)?.photo} size="m" state="winner" />} title={first.name} value={<CountUp value={Math.round(first.rating)} />} bigValue subtitle="Rating, høyest akkurat nå" />
        </Section>
      )}
    </div>
  );
}
