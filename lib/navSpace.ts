"use client";

import { useEffect } from "react";

/** The room the bottom bar takes, as a page variable: screens add it to their bottom padding so the last row is never under the bar. */
export const NAV_SPACE = "4.5rem";

/** On a wide screen the menu stands at the side instead, and takes this much of the width. */
export const NAV_RAIL = "6rem";

export function useNavSpace(visible: boolean): void {
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--nav-space", visible ? NAV_SPACE : "0px");
    root.setProperty("--nav-rail", visible ? NAV_RAIL : "0px");
    return () => {
      root.setProperty("--nav-space", "0px");
      root.setProperty("--nav-rail", "0px");
    };
  }, [visible]);
}
