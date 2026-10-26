"use client";

import { createContext, useContext } from "react";
import type { AccessLevel } from "./pin";

/**
 * What the code a device was let in with allows (lib/pin.ts). The limited code plays, sets up and adds people and bots, but
 * deletes no team or player and sees no statistics, seeding, records, betting or big screen. Pages are shut in PinGate by
 * the paths below; buttons and links to them, and the deleting, are left out where they are drawn, using `useAccess`.
 */
const AccessContext = createContext<AccessLevel>("full");

export const AccessProvider = AccessContext.Provider;

export function useAccess(): { level: AccessLevel; limited: boolean } {
  const level = useContext(AccessContext);
  return { level, limited: level === "limited" };
}

/** The pages the limited code cannot open: statistics (with seeding and records), the nights and matches they lead to,
 *  the hall of fame, betting and the big screen. */
export const LIMITED_BLOCKED_PATHS = ["/statistikk", "/hall-of-fame", "/kveld", "/kamp", "/bet", "/storskjerm"];

/** Whether the limited code is kept out of this path (the page itself and anything under it). */
export function blockedForLimited(pathname: string | null): boolean {
  if (!pathname) return false;
  return LIMITED_BLOCKED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
