"use client";

import { usePathname } from "next/navigation";
import { useNavSpace } from "@/lib/navSpace";
import { BottomNav, navKeyFor } from "./ui/BottomNav";

/**
 * The bottom bar for every page that is its own address (Spillere, Statistikk, Mer and what lies under them). The front page
 * draws its own, because Turnering opens in place there; and the big screen and the matches have none.
 */
export function AppNav() {
  const pathname = usePathname();
  const show = pathname !== "/" && navKeyFor(pathname) !== null;
  useNavSpace(show);
  return show ? <BottomNav /> : null;
}
