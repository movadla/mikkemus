"use client";

import { useState } from "react";
import { getPlayerRecord, setPlayerSound } from "@/lib/storage";
import { reportError } from "@/lib/errorReporting";
import { MicIcon } from "./icons";

const RECORDING_MS = 2000;

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * Records the two-second clip that plays when it is this player's turn. It lives on the player's
 * own page now: it was a microphone on every row of the setup screen, taking space at every
 * match for something people do once.
 */
export function SoundClipButton({ name }: { name: string }) {
  const [recording, setRecording] = useState(false);
  const [hasSound, setHasSound] = useState(() => !!getPlayerRecord(name)?.sound);

  async function record() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        // Busy indicator stays lit until the save actually finishes, not just until recording stops.
        reader.onload = () => {
          setPlayerSound(name, reader.result as string);
          setHasSound(true);
          setRecording(false);
        };
        reader.onerror = () => {
          reportError("Kunne ikke lagre lydklippet.", { key: "sound-save" });
          setRecording(false);
        };
        reader.readAsDataURL(blob);
      };
      setRecording(true);
      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, RECORDING_MS);
    } catch {
      setRecording(false);
      reportError("Fikk ikke tilgang til mikrofonen.", { key: "mic-permission" });
    }
  }

  return (
    <button
      type="button"
      onClick={record}
      disabled={recording}
      className={`tactile w-full rounded-lg flex items-center justify-center gap-2 ${FOCUS_RING}`}
      style={{
        minHeight: "var(--control)",
        background: recording ? "var(--color-red)" : "var(--color-surface)",
        color: recording ? "var(--color-cream)" : hasSound ? "var(--color-teal)" : "var(--color-cream)",
        border: "1px solid var(--color-border)",
      }}
    >
      <MicIcon className="w-4 h-4" />
      {recording ? "Tar opp …" : hasSound ? "Nytt lydklipp" : "Ta opp lydklipp"}
    </button>
  );
}
