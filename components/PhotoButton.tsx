"use client";

import { useRef, useState } from "react";
import { setPlayerPhoto } from "@/lib/storage";
import { reportError } from "@/lib/errorReporting";
import { CameraIcon } from "./icons";
import { PhotoCropper } from "./PhotoCropper";
import { Avatar } from "./ui/Avatar";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The picture of a player or a team, and the way to change it: a tap opens the phone's own
 * sheet — camera or library. It lives on the player's own page, like the sound clip; it was a
 * camera on every row of the setup screen, taking space at every match for something people do
 * once.
 */
export function PhotoButton({ name, photo, size = 56 }: { name: string; photo?: string; size?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The picture that was chosen and is being cropped (see PhotoCropper) before it is kept.
  const [cropping, setCropping] = useState<File | null>(null);

  function onSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Cropped first, to a small square: the camera's file is megabytes, and every picture is fetched with the player list.
    setCropping(file);
  }

  return (
    <>
      {/* No `capture` attribute: with it, iOS opens the camera directly and offers no way to reach
          the photo library at all. Without it the OS shows its normal sheet, which has both. */}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onSelected} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={photo ? `Nytt bilde av ${name}` : `Velg bilde av ${name}`}
        className={`tactile relative rounded-full shrink-0 inline-flex ${FOCUS_RING}`}
        style={{ background: "transparent", boxShadow: "none" }}
      >
        <Avatar name={name} photo={photo} px={size} />
        <span
          aria-hidden
          className="absolute flex items-center justify-center rounded-full"
          style={{ right: 0, bottom: 0, width: "1.5rem", height: "1.5rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)", boxShadow: "var(--elevation-1)" }}
        >
          <CameraIcon className="w-3 h-3" />
        </span>
      </button>
      {cropping && (
        <PhotoCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(dataUrl) => {
            setCropping(null);
            try {
              setPlayerPhoto(name, dataUrl);
            } catch {
              reportError("Kunne ikke lagre bildet.", { key: "photo-read" });
            }
          }}
        />
      )}
    </>
  );
}
