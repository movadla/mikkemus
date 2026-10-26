"use client";

import { useEffect } from "react";
import { applyFxLevel, getFxLevel } from "@/lib/fxLevel";
import { applyTexture, getTexture } from "@/lib/texture";
import { applyTheme, getTheme } from "@/lib/theme";

/** Puts the device's texture choice on the page once it has loaded. Draws nothing. */
export function TextureSetting() {
  useEffect(() => {
    applyTexture(getTexture());
    applyFxLevel(getFxLevel());
    applyTheme(getTheme());
  }, []);
  return null;
}
