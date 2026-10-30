"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccess } from "@/lib/access";
import { ChartIcon, DartIcon, MoreIcon, PeopleIcon, TrophyIcon } from "../icons";
import { FOCUS_RING } from "./focus";

export type NavKey = "spill" | "turnering" | "spillere" | "statistikk" | "mer";

type Item = { key: NavKey; label: string; href: string; icon: ReactNode; full?: boolean };

const ITEMS: Item[] = [
  { key: "spill", label: "Spill", href: "/", icon: <DartIcon className="w-6 h-6" /> },
  { key: "turnering", label: "Turnering", href: "/?m=turnering", icon: <TrophyIcon className="w-6 h-6" />, full: true },
  { key: "spillere", label: "Spillere", href: "/spillere", icon: <PeopleIcon className="w-6 h-6" /> },
  { key: "statistikk", label: "Statistikk", href: "/statistikk", icon: <ChartIcon className="w-6 h-6" />, full: true },
  { key: "mer", label: "Mer", href: "/mer", icon: <MoreIcon className="w-6 h-6" /> },
];

/** Which tab a page belongs to, by its address. */
export function navKeyFor(pathname: string): NavKey | null {
  if (pathname === "/") return "spill";
  if (pathname.startsWith("/spillere")) return "spillere";
  // Kveldsscore is reached from Mer and from the front page; the story of a night under it belongs to Statistikk.
  if (pathname === "/kveld") return "mer";
  if (pathname.startsWith("/statistikk") || pathname.startsWith("/hall-of-fame") || pathname.startsWith("/kveld") || pathname.startsWith("/kamp")) return "statistikk";
  if (pathname.startsWith("/mer") || pathname.startsWith("/bet") || pathname.startsWith("/innstillinger") || pathname.startsWith("/lyd")) return "mer";
  return null;
}

/**
 * The bar along the bottom of every screen that is not a match: the five places of the app, the one you are in lit. The same on
 * every page, so there is no "back to the front page" to look for. Turnering and Statistikk are for the full code only.
 * On the front page itself, `onTurnering` opens the tournament in place rather than by address.
 */
export function BottomNav({ current, onTurnering }: { current?: NavKey | null; onTurnering?: () => void }) {
  const pathname = usePathname();
  const { limited } = useAccess();
  const active = current ?? navKeyFor(pathname);
  const items = ITEMS.filter((i) => !(limited && i.full));
  const cell = `tactile flex flex-col items-center justify-center gap-1 flex-1 min-w-0 md:flex-none md:py-3 ${FOCUS_RING}`;
  return (
    <nav aria-label="Hovedmeny" className="bottom-nav fixed left-0 right-0 bottom-0 z-40 md:right-auto md:top-0 md:w-24 md:border-t-0">
      <div className="bottom-nav-pill mx-auto flex max-w-md md:max-w-none md:flex-col md:h-full md:justify-center md:gap-2 md:px-1">
        {items.map((i) => {
          const on = i.key === active;
          const style = { minHeight: "var(--control-lg)", color: on ? "var(--color-teal)" : "var(--color-muted)", fontSize: "var(--text-micro)", fontWeight: on ? 700 : 500, boxShadow: "none", background: on ? "var(--teal-soft)" : "transparent", borderRadius: "var(--radius-pill)" } as const;
          const body = (
            <>
              {i.icon}
              <span>{i.label}</span>
            </>
          );
          if (i.key === "turnering" && onTurnering) {
            return (
              <button key={i.key} type="button" onClick={onTurnering} aria-current={on ? "page" : undefined} className={cell} style={style}>
                {body}
              </button>
            );
          }
          return (
            <Link key={i.key} href={i.href} aria-current={on ? "page" : undefined} className={cell} style={style}>
              {body}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
