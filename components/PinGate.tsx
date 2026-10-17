"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LOCK_SECONDS, MAX_TRIES, PIN_LENGTH, checkPin, isRemembered, lockSeconds, rememberDevice } from "@/lib/pin";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The door of the app: a four-digit code (lib/pin.ts), asked for once on each device and then remembered. A lock
 * on a door rather than a safe, as the note there says. Nothing behind it is drawn, and so nothing is fetched,
 * until the code is right.
 */
export function PinGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");

  // What this device has stored is only known in the browser, so the first answer waits for it.
  useEffect(() => {
    const t = setTimeout(() => setState(isRemembered() ? "open" : "locked"), 0);
    return () => clearTimeout(t);
  }, []);

  if (state === "open") return <>{children}</>;
  if (state === "checking") return <div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />;
  return <PinScreen onUnlocked={() => setState("open")} />;
}

function PinScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  const [fails, setFails] = useState(0);
  const [locks, setLocks] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);
  const busy = useRef(false);

  // While locked, count down the seconds.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  const submit = useCallback(
    async (code: string) => {
      busy.current = true;
      const ok = await checkPin(code);
      if (ok) {
        rememberDevice();
        onUnlocked();
        return;
      }
      const f = fails + 1;
      setWrong(true);
      if (f >= MAX_TRIES) {
        const l = locks + 1;
        setLocks(l);
        setFails(0);
        setLockedFor(lockSeconds(l));
      } else setFails(f);
      setTimeout(() => {
        setDigits("");
        setWrong(false);
        busy.current = false;
      }, 450);
    },
    [fails, locks, onUnlocked],
  );

  const press = useCallback(
    (d: string) => {
      if (busy.current || lockedFor > 0) return;
      setDigits((cur) => {
        if (cur.length >= PIN_LENGTH) return cur;
        const next = cur + d;
        if (next.length === PIN_LENGTH) void submit(next);
        return next;
      });
    },
    [lockedFor, submit],
  );
  const back = useCallback(() => {
    if (busy.current || lockedFor > 0) return;
    setDigits((cur) => cur.slice(0, -1));
  }, [lockedFor]);

  // A keyboard works too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9" && e.key.length === 1) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const keyStyle = { width: "4.5rem", height: "4.5rem", borderRadius: 999, background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "1.6rem" } as const;
  return (
    <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 px-6" style={{ background: "var(--color-bg)", color: "var(--color-cream)" }}>
      <div className="text-center">
        <h1 className="font-display" style={{ fontSize: "1.8rem" }}>Mikke Mus</h1>
        <p style={{ color: "var(--color-muted)", fontSize: "0.9rem", marginTop: 6 }}>Skriv inn koden</p>
      </div>
      <div className="flex gap-4" style={{ animation: wrong ? "pin-shake 420ms" : undefined }} aria-hidden>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${wrong ? "var(--color-red)" : "var(--color-gold)"}`, background: i < digits.length ? (wrong ? "var(--color-red)" : "var(--color-gold)") : "transparent", transition: "background 80ms" }}
          />
        ))}
      </div>
      <p role="status" aria-live="polite" style={{ minHeight: "1.3rem", color: lockedFor > 0 ? "var(--color-gold-strong)" : "var(--color-red)", fontSize: "0.9rem" }}>
        {lockedFor > 0 ? `For mange feil forsøk. Vent ${lockedFor} s.` : wrong ? "Feil kode" : ""}
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 4.5rem)" }}>
        {keys.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className={`tactile ${FOCUS_RING}`} style={keyStyle} disabled={lockedFor > 0} aria-label={k}>
            {k}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" onClick={() => press("0")} className={`tactile ${FOCUS_RING}`} style={keyStyle} disabled={lockedFor > 0} aria-label="0">
          0
        </button>
        <button type="button" onClick={back} className={`tactile ${FOCUS_RING}`} style={{ ...keyStyle, fontSize: "1.1rem", color: "var(--color-muted)" }} disabled={lockedFor > 0} aria-label="Slett siste siffer">
          ⌫
        </button>
      </div>
      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>Enheten husker koden. Låser seg {LOCK_SECONDS} s etter {MAX_TRIES} feil.</p>
    </main>
  );
}
