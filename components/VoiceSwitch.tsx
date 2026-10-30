"use client";

import { useState } from "react";
import { isCallerEnabled, setCallerEnabled } from "@/lib/announcer";
import { SpeakerIcon, SpeakerMuteIcon } from "./icons";
import { SwitchRow } from "./ui/Switch";
import { FOCUS_RING } from "./ui/focus";

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

/** The same switch as a small round button for the top of a screen, where a whole row with a hint would take the room of the keys. */
export function VoiceToggle() {
  const [on, setOn] = useState(isCallerEnabled);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Stemme"
      onClick={() => {
        setOn(!on);
        setCallerEnabled(!on);
      }}
      className={`tactile inline-flex items-center justify-center ${FOCUS_RING}`}
      style={{ width: "var(--control)", height: "var(--control)", borderRadius: "var(--radius-m)", background: on ? "var(--teal-soft)" : "var(--color-surface)", color: on ? "var(--color-teal)" : "var(--color-muted)", border: `1px solid ${on ? "var(--color-teal)" : "var(--color-border)"}` }}
    >
      {on ? <SpeakerIcon className="w-5 h-5" /> : <SpeakerMuteIcon className="w-5 h-5" />}
    </button>
  );
}
