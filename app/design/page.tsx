"use client";

import { useState, type ReactNode } from "react";
import { CupEmblem } from "@/components/ui/CupEmblem";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CountUp } from "@/components/ui/CountUp";
import { EmptyState } from "@/components/ui/EmptyState";
import { Num } from "@/components/ui/Num";
import { PlayerCard } from "@/components/ui/PlayerCard";
import { Row } from "@/components/ui/Row";
import { ScreenTop } from "@/components/ScreenTop";
import { Section } from "@/components/ui/Section";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { SwitchRow } from "@/components/ui/Switch";
import { avatarAccent, PLAYER_COLOURS } from "@/lib/avatarAccent";
import { CUP_TYPES } from "@/lib/botCup";
import { PeopleIcon } from "@/components/icons";

/** The tokens, by group. Each swatch is drawn from the token itself, so this page is the palette as it is, in whichever theme is on. */
const GROUND = ["--color-bg", "--color-panel", "--color-surface", "--color-surface-2", "--color-cell", "--color-border"];
const INK = ["--color-cream", "--color-text-2", "--color-muted"];
const ACCENT = ["--color-teal", "--color-teal-strong", "--color-gold", "--color-gold-strong", "--color-red", "--color-green", "--color-silver", "--color-bronze"];
const TEXT = [
  ["--text-micro", "Mikro: undertekster"],
  ["--text-small", "Liten: hjelpetekst"],
  ["--text-body", "Brødtekst: valg og rader"],
  ["--text-title", "Tittel: kort og ark"],
  ["--text-num", "Tall: det som skal leses fra andre siden av rommet"],
] as const;

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span aria-hidden style={{ height: "2.5rem", borderRadius: "var(--radius-s)", background: `var(${token})`, border: "1px solid var(--color-hairline)" }} />
      <code className="truncate" style={{ color: "var(--color-text-2)", fontSize: "var(--text-micro)" }}>
        {token}
      </code>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section label={title}>
      <div className="space-y-3">{children}</div>
    </Section>
  );
}

/**
 * Stilarket: every colour, size and part of the app on one page, in the theme that is on. It is not linked from anywhere; it is where
 * a change to a shared part is seen once, and what the screenshot tests take a picture of, so a part that changes shows up in the diff.
 */
export default function DesignPage() {
  const [seg, setSeg] = useState("b");
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState(true);
  const [run, setRun] = useState(0);
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner wide">
        <ScreenTop title="Stilark" />

        <div className="wide-columns">
          <div>
            <Group title="Flater og strek">
              <div className="grid grid-cols-3 gap-3">
                {GROUND.map((t) => (
                  <Swatch key={t} token={t} />
                ))}
              </div>
            </Group>
            <Group title="Tekst">
              <div className="grid grid-cols-3 gap-3">
                {INK.map((t) => (
                  <Swatch key={t} token={t} />
                ))}
              </div>
            </Group>
            <Group title="Aksenter">
              <div className="grid grid-cols-4 gap-3">
                {ACCENT.map((t) => (
                  <Swatch key={t} token={t} />
                ))}
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Turkis er det vanlige å trykke på. Gull er det som er vunnet. Rød er angre, slett og feil.</p>
            </Group>
            <Group title="Spillerfarger">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: PLAYER_COLOURS }, (_, i) => (
                  <Swatch key={i} token={`--player-${i + 1}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {["Lars", "Moen", "Vadla", "Hans", "Charlotte", "Sondre"].map((n) => (
                  <Avatar key={n} name={n} size="m" />
                ))}
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Én farge per navn, den samme i ring, stripe og diagram. Fargen til «Lars» er {avatarAccent("Lars").replace("var(", "").replace(")", "")}.</p>
            </Group>
            <Group title="Pokaler">
              <div className="flex flex-wrap gap-4">
                {CUP_TYPES.map((c) => (
                  <span key={c.kind} style={{ color: `var(--cup-${c.kind})` }}>
                    <CupEmblem kind={c.kind} className="w-8 h-8" />
                  </span>
                ))}
              </div>
            </Group>
            <Group title="Tekststørrelser">
              {TEXT.map(([token, sample]) => (
                <p key={token} style={{ fontSize: `var(${token})`, color: "var(--color-cream)" }}>
                  <code style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>{token}</code> {sample}
                </p>
              ))}
            </Group>
            <Group title="Tall">
              <div className="flex items-end gap-6 flex-wrap">
                <Num value="1 553" unit="rating" />
                <Num value={<CountUp value={84} />} unit="%" />
                <Num value="3,4" unit="piler" size="title" />
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Hele tallet stort, i displayskriften med like brede sifre. Det som hører til er lite og stille.</p>
            </Group>
          </div>

          <div>
            <Group title="Knapper">
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Primær</Button>
                <Button>Sekundær</Button>
                <Button variant="ghost">Uten boks</Button>
                <Button variant="danger">Slett</Button>
                <Button disabled>Av</Button>
              </div>
            </Group>
            <Group title="Valg">
              <Segmented value={seg} onChange={setSeg} label="Eksempel" options={[{ value: "a", label: "Ett" }, { value: "b", label: "To" }, { value: "c", label: "Tre" }]} />
              <div className="flex gap-2">
                <Chip selected={chip} onClick={() => setChip(!chip)}>
                  Valgt
                </Chip>
                <Chip selected={!chip} onClick={() => setChip(!chip)}>
                  Ikke valgt
                </Chip>
              </div>
              <SwitchRow label="Av og på" hint="En innstilling" checked={on} onChange={setOn} />
            </Group>
            <Group title="Rader">
              <div className="space-y-2">
                <Row title="Vanlig rad" subtitle="Med en linje under" href="/design" />
                <Row title="Spiller" subtitle="Med spillerens stripe" accent={avatarAccent("Lars")} leading={<Avatar name="Lars" size="m" />} value="1 553" href="/design" />
                <Row title="Vunnet" tone="gold" value="Rekord" />
                <Row title="Valgt" selected />
              </div>
            </Group>
            <Group title="Kort">
              <div className="space-y-2">
                <Card level="flat">Flatt: grupperer</Card>
                <Card>Hevet: et resultat eller en handling</Card>
                <Card level="gold">Gull: det som er vunnet</Card>
              </div>
            </Group>
            <Group title="Spillerkort">
              <PlayerCard name="Lars" caption="12 kamper" figure="1 553" figureLabel="RATING">
                <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Det stedet legger til under.</p>
              </PlayerCard>
              <PlayerCard name="Moen" size="card" caption="Lag" figure="3–1" />
            </Group>
            <Group title="Bevegelse">
              <div className="flex items-center gap-3 flex-wrap">
                {([["fjær", "motion-spring"], ["trekk", "motion-pull"], ["tyngde", "motion-weight"]] as const).map(([label, cls]) => (
                  <span key={`${label}-${run}`} className={`motion-demo ${cls}`}>
                    {label}
                  </span>
                ))}
                <Button onClick={() => setRun((n) => n + 1)}>Spill av</Button>
              </div>
              <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>Fjær svarer på et trykk, trekk kommer inn fra siden eller nedenfra, tyngde setter seg på verdien sin.</p>
            </Group>
            <Group title="Tomt og laster">
              <EmptyState icon={<PeopleIcon className="w-6 h-6" />} title="Ingen spillere ennå" action={<Button variant="primary">Start en kamp</Button>} />
              <SkeletonRows count={2} />
            </Group>
          </div>
        </div>
      </div>
    </div>
  );
}
