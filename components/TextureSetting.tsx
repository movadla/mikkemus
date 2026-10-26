"use client";

import { useEffect } from "react";
import { applyFxLevel, getFxLevel } from "@/lib/fxLevel";
import { applyTexture, getTexture } from "@/lib/texture";
import { applyTheme, getThemeChoice } from "@/lib/theme";

/** Puts the device's texture choice on the page once it has loaded. Draws nothing. */
export function TextureSetting() {
  useEffect(() => {
    applyTexture(getTexture());
    applyFxLevel(getFxLevel());
    applyTheme();
    // Auto follows the phone from every page, not only the one with the setting: when it goes to night or day, so does the page.
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onSystem = () => {
      if (getThemeChoice() === "auto") applyTheme("auto", true);
    };
    mq.addEventListener("change", onSystem);
    return () => mq.removeEventListener("change", onSystem);
  }, []);
  return null;
}
