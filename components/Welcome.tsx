"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { BrandSymbol, Wordmark } from "./ui/BrandMark";
import { BullseyeIcon, DartIcon, PeopleIcon, TrophyIcon } from "./icons";

const STEPS = [
  { icon: <BullseyeIcon className="w-10 h-10" />, title: "Mikke Mus", body: "Dart med ti rader: 20 ned til 14, så dobbel, trippel og bull. Den som først har lukket alle, vinner." },
  { icon: <PeopleIcon className="w-10 h-10" />, title: "Hvem er med", body: "Legg til spillere når du starter en kamp. De husker seg selv, med bilde, drakt og statistikk." },
  { icon: <TrophyIcon className="w-10 h-10" />, title: "Kamp eller pokal", body: "Spill en enkeltkamp, eller en turnering mot boter om en pokal. Resultatene samles i statistikken." },
];

const KEY = "mikke-mus-welcomed";

/** Whether this device has been shown the welcome. */
export function hasBeenWelcomed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Shown again next time, which is harmless.
  }
}

/** The first time: three short screens about what the app is, who plays, and what to play. Can be skipped at any point. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  return (
    <div className="animate-screen-enter screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <Wordmark />
          <Button variant="ghost" onClick={onDone}>
            Hopp over
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
          <span className="flex items-center justify-center" style={{ width: "6rem", height: "6rem", borderRadius: "50%", background: "var(--teal-soft)", border: "1px solid var(--teal-ring)", color: "var(--color-teal)" }}>
            {step === 0 ? <BrandSymbol size={56} /> : s.icon}
          </span>
          <h1 className="font-display" style={{ fontSize: "var(--text-num)", color: "var(--color-cream)" }}>
            {s.title}
          </h1>
          <p style={{ color: "var(--color-text-2)", fontSize: "var(--text-body)", maxWidth: "24rem" }}>{s.body}</p>
        </div>
        <div className="flex justify-center gap-2 mb-6" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: i === step ? "var(--color-teal)" : "var(--color-border)" }} />
          ))}
        </div>
        <Button variant="primary" size="lg" block icon={last ? <DartIcon className="w-5 h-5" /> : undefined} onClick={() => (last ? onDone() : setStep(step + 1))}>
          {last ? "Kom i gang" : "Neste"}
        </Button>
      </div>
    </div>
  );
}
