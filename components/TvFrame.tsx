"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { dayLabel } from "@/lib/formatDate";
import { groupNights } from "@/lib/nights";
import { useRoster } from "@/lib/storage";

/**
 * The frame every big-screen page shares, so the TV looks like one broadcast whichever page is on it: a plain dark ground
 * (no grain), the name of the app small along the top with what is being shown, and along the bottom the last night's winner.
 * The way home is nearly invisible until someone reaches for it; this page's whole point is to fill a room.
 */
export function TvFrame({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  const roster = useRoster();
  const last = groupNights(roster)[0];
  const winner = last?.players[0];

  // No grain on a television: the page asks for it off while it is open.
  useEffect(() => {
    document.documentElement.dataset.tv = "on";
    return () => {
      delete document.documentElement.dataset.tv;
    };
  }, []);

  return (
    <div className={`tv relative min-h-screen w-full flex flex-col ${className}`} style={{ background: "var(--color-bg)", color: "var(--color-cream)" }}>
      <Link
        href="/"
        className="fixed top-2 left-2 z-40 inline-flex items-center px-4 text-xs opacity-20 hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)] transition-opacity"
        style={{ color: "var(--color-cream)", minHeight: "var(--control)" }}
      >
        Hjem
      </Link>
      <div className="absolute top-3 left-0 right-0 z-30 flex items-center justify-center gap-3 pointer-events-none" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
        <span className="font-display" style={{ color: "var(--color-cream)", letterSpacing: "0.08em", fontSize: "var(--text-body)" }}>
          Mikke Mus
        </span>
        <span aria-hidden>·</span>
        <span>{label}</span>
      </div>
      {children}
      {last && winner && winner.wins > 0 && (
        <p className="absolute bottom-3 left-0 right-0 text-center pointer-events-none" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
          {dayLabel(last.date)}: {winner.name} vant
        </p>
      )}
    </div>
  );
}
