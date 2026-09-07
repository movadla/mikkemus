"use client";

import Link from "next/link";
import { playFanfareVariant, playHitStreakSound, playPerfectRoundVariant, primeAudio } from "@/lib/fanfare";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

type SoundRow = { label: string; hint: string; play: () => void; accent: string };

const WIN_FANFARES: SoundRow[] = [
  {
    label: "1 — Stigende kall",
    hint: "Tre korte toner opp i en holdt topptone over en akkord, med et avsluttende anslag. Dette er den som spilles i dag.",
    play: () => playFanfareVariant(1),
    accent: "var(--color-gold)",
  },
  {
    label: "2 — Charge!",
    hint: "Kort og drivende, som kavaleri-signalet: tre like toner som presser oppover før topptonen holdes.",
    play: () => playFanfareVariant(2),
    accent: "var(--color-gold)",
  },
  {
    label: "3 — Bred og pompøs",
    hint: "Roligere, starter lavt og lander i en stor liggende durakkord. Mer orkester enn solotrompet.",
    play: () => playFanfareVariant(3),
    accent: "var(--color-gold)",
  },
];

const PERFECT_ROUNDS: SoundRow[] = [
  {
    label: "1 — Liten fanfare",
    hint: "Stigende kall opp i en holdt akkord. Spilles i dag.",
    play: () => playPerfectRoundVariant(1),
    accent: "var(--color-teal)",
  },
  {
    label: "2 — Rask opptur",
    hint: "Kjapp løping oppover som lander lyst. Mer «ka-ching» enn fanfare.",
    play: () => playPerfectRoundVariant(2),
    accent: "var(--color-teal)",
  },
];

const HIT_SOUNDS: SoundRow[] = [
  {
    label: "Treff på pil 1",
    hint: "Stille «dunk-pling».",
    play: () => playHitStreakSound(1),
    accent: "var(--color-green)",
  },
  {
    label: "Treff på pil 1 + 2",
    hint: "Samme lyd, høyere og lysere.",
    play: () => playHitStreakSound(2),
    accent: "var(--color-green)",
  },
];

function Section({ title, rows }: { title: string; rows: SoundRow[] }) {
  return (
    <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
      <p className="mb-3" style={{ color: "var(--color-gold)", fontSize: "0.85rem", letterSpacing: "0.1em" }}>
        {title}
      </p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <button
              type="button"
              onClick={row.play}
              className={`tactile w-full py-3 rounded-lg font-semibold ${FOCUS_RING}`}
              style={{ background: row.accent, color: "var(--color-bg)" }}
            >
              ▶ {row.label}
            </button>
            <p className="mt-1.5 px-1" style={{ color: "var(--color-muted)", fontSize: "0.7rem", lineHeight: 1.45 }}>
              {row.hint}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A place to actually hear the sounds without winning a match for each one — every sound in
 * the app is synthesized (lib/fanfare.ts), so there's no audio file to click through in a
 * folder, and tuning them blind through deploy-and-play cycles doesn't work. Also carries
 * the alternative fanfares side by side, so picking a favourite is one tap each.
 */
export default function LydPage() {
  return (
    <div
      className="animate-screen-enter min-h-screen w-full p-4"
      style={{ background: "var(--color-bg)" }}
      // Any tap here unlocks audio playback for the page — see primeAudio.
      onPointerDownCapture={primeAudio}
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-5 pt-2">
          <Link
            href="/"
            className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
            style={{ background: "var(--color-surface)", color: "var(--color-cream)" }}
          >
            ← Hjem
          </Link>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.5rem" }}>
            Lyder
          </h1>
          <span className="w-16" aria-hidden />
        </div>

        <p className="mb-5 px-1" style={{ color: "var(--color-muted)", fontSize: "0.8rem", lineHeight: 1.5 }}>
          Trykk for å høre. Si fra hvilken seiersfanfare og hvilken perfekt-runde-lyd du vil ha, så gjør jeg den til
          standard. Alle lydene lages i kode — det finnes ingen lydfiler å bytte ut ennå.
        </p>

        <Section title="SEIERSFANFARE — KAMPEN VUNNET" rows={WIN_FANFARES} />
        <Section title="PERFEKT RUNDE — TREFF PÅ ALLE TRE" rows={PERFECT_ROUNDS} />
        <Section title="TREFF UNDERVEIS I RUNDEN" rows={HIT_SOUNDS} />

        <p className="mt-6 mb-2 px-1 text-center" style={{ color: "var(--color-muted)", fontSize: "0.7rem", lineHeight: 1.5 }}>
          Hører du ingenting: sjekk at telefonen ikke står på stille, og trykk én gang til — første trykk låser opp lyd i
          nettleseren.
        </p>
      </div>
    </div>
  );
}
