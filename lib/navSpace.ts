"use client";

import { useEffect } from "react";

/** The room the bottom bar takes, as a page variable: screens add it to their bottom padding so the last row is never under the bar. */
export const NAV_SPACE = "4.5rem";

export function useNavSpace(visible: boolean): void {
  useEffect(() => {
    document.documentElement.style.setProperty("--nav-space", visible ? NAV_SPACE : "0px");
    return () => document.documentElement.style.setProperty("--nav-space", "0px");
  }, [visible]);
}
