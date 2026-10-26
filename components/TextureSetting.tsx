"use client";

import { useEffect } from "react";
import { applyTexture, getTexture } from "@/lib/texture";

/** Puts the device's texture choice on the page once it has loaded. Draws nothing. */
export function TextureSetting() {
  useEffect(() => {
    applyTexture(getTexture());
  }, []);
  return null;
}
