"use client";

import { useState } from "react";
import { isCallerEnabled, setCallerEnabled } from "@/lib/announcer";
import { SwitchRow } from "./ui/Switch";

/** The switch for the caller: the voice that says the number after a round. The same setting in every game that has one. */
export function VoiceSwitch({ hint = "Sier tallet høyt etter hver runde" }: { hint?: string }) {
  const [on, setOn] = useState(isCallerEnabled);
  return (
    <SwitchRow
      label="Stemme"
      hint={hint}
      checked={on}
      onChange={(next) => {
        setOn(next);
        setCallerEnabled(next);
      }}
    />
  );
}
