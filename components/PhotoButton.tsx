"use client";

import { useRef } from "react";
import { setPlayerPhoto } from "@/lib/storage";
import { reportError } from "@/lib/errorReporting";
import { photoToDataUrl } from "@/lib/image";
import { avatarAccent } from "@/lib/avatarAccent";
import { CameraIcon } from "./icons";

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

/**
 * The picture of a player or a team, and the way to change it: a tap opens the phone's own
 * sheet — camera or library. It lives on the player's own page, like the sound clip; it was a
 * camera on every row of the setup screen, taking space at every match for something people do
 * once.
 */
export function PhotoButton({ name, photo, size = "3.5rem" }: { name: string; photo?: string; size?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Shrunk first: the camera's file is megabytes, and every picture is fetched with the player list.
    photoToDataUrl(file)
      .then((dataUrl) => setPlayerPhoto(name, dataUrl))
      .catch(() => reportError("Kunne ikke lese bildet.", { key: "photo-read" }));
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
        className={`tactile relative rounded-full overflow-hidden shrink-0 flex items-center justify-center ${FOCUS_RING}`}
        style={{ width: size, height: size, background: "var(--color-cell)", border: `1.5px solid ${avatarAccent(name)}` }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display" style={{ color: avatarAccent(name), fontSize: "1.3rem" }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span
          aria-hidden
          className="absolute flex items-center justify-center rounded-full"
          style={{ right: 0, bottom: 0, width: "1.25rem", height: "1.25rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
        >
          <CameraIcon className="w-3 h-3" />
        </span>
      </button>
    </>
  );
}
