"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessProvider, blockedForLimited } from "@/lib/access";
import { Wordmark } from "./ui/BrandMark";
import { LOCK_SECONDS, MAX_TRIES, PIN_LENGTH, SIGN_OUT_EVENT, checkPin, lockSeconds, rememberDevice, rememberedLevel, type AccessLevel } from "@/lib/pin";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The door of the app: a four-digit code (lib/pin.ts), asked for once on each device and then remembered. A lock
 * on a door rather than a safe, as the note there says. Nothing behind it is drawn, and so nothing is fetched,
 * until the code is right. There are two codes: the one that lets everything through, and the one that keeps the
 * statistics, betting and big screen shut (see lib/access.tsx), whose pages are then never drawn.
 */
export function PinGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | AccessLevel>("checking");
  const pathname = usePathname();

  // What this device has stored is only known in the browser, so the first answer waits for it.
  useEffect(() => {
    const t = setTimeout(() => setState(rememberedLevel() ?? "locked"), 0);
    return () => clearTimeout(t);
  }, []);

  // Logging out (Innstillinger) closes the door at once, on any page.
  useEffect(() => {
    const out = () => setState("locked");
    window.addEventListener(SIGN_OUT_EVENT, out);
    return () => window.removeEventListener(SIGN_OUT_EVENT, out);
  }, []);

  if (state === "checking") return <div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />;
  if (state === "locked") return <PinScreen onUnlocked={setState} />;
  return <AccessProvider value={state}>{state === "limited" && blockedForLimited(pathname) ? <NotForThisCode /> : children}</AccessProvider>;
}

function NotForThisCode() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "var(--color-bg)", color: "var(--color-cream)" }}>
      <h1 className="font-display" style={{ fontSize: "var(--text-num)" }}>Ikke tilgjengelig</h1>
      <p style={{ color: "var(--color-muted)" }}>Denne siden åpnes ikke med koden du brukte.</p>
      <Link href="/" className={`tactile rounded-lg px-6 ${FOCUS_RING}`} style={{ minHeight: "var(--control)", lineHeight: "2.75rem", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        Til forsiden
      </Link>
    </main>
  );
}

function PinScreen({ onUnlocked }: { onUnlocked: (level: AccessLevel) => void }) {
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
      const level = await checkPin(code);
      if (level) {
        rememberDevice(level);
        onUnlocked(level);
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
  const keyStyle = { width: "4.5rem", height: "4.5rem", borderRadius: 999, background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "var(--text-num)" } as const;
  return (
    <main className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 px-6" style={{ background: "var(--color-bg)", color: "var(--color-cream)" }}>
      <div className="text-center">
        <h1>
          <Wordmark size="num" align="center" />
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: "var(--text-body)", marginTop: 6 }}>Skriv inn koden</p>
      </div>
      <div className="flex gap-4" style={{ animation: wrong ? "pin-shake 420ms" : undefined }} aria-hidden>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${wrong ? "var(--color-red)" : "var(--color-gold)"}`, background: i < digits.length ? (wrong ? "var(--color-red)" : "var(--color-gold)") : "transparent", transition: "background 80ms" }}
          />
        ))}
      </div>
      <p role="status" aria-live="polite" style={{ minHeight: "1.3rem", color: lockedFor > 0 ? "var(--color-gold-strong)" : "var(--color-red)", fontSize: "var(--text-body)" }}>
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
        <button type="button" onClick={back} className={`tactile ${FOCUS_RING}`} style={{ ...keyStyle, fontSize: "var(--text-title)", color: "var(--color-muted)" }} disabled={lockedFor > 0} aria-label="Slett siste siffer">
          ⌫
        </button>
      </div>
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)" }}>Enheten husker koden. Låser seg {LOCK_SECONDS} s etter {MAX_TRIES} feil.</p>
    </main>
  );
}
