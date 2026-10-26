"use client";

import { useState } from "react";
import { CameraIcon } from "./icons";
import { Sheet } from "./ui/Sheet";
import { FOCUS_RING } from "./ui/focus";

type Props = { images: string[] };

/**
 * The camera pictures from the board (see lib/extractImageUrls.ts), kept out of the way: a small button at the top of the screen says
 * there are some, and a tap opens them in a sheet. They used to lie over the Bekreft button while the board was calibrated.
 * Renders nothing when there are none. Confirmed against real board output 2026-09-07: three base64 JPEGs, one per camera, per takeout.
 */
export function CameraImages({ images }: Props) {
  const [open, setOpen] = useState(false);
  if (images.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Vis kamerabildene (${images.length})`}
        className={`tactile fixed z-40 inline-flex items-center gap-2 px-3 ${FOCUS_RING}`}
        style={{
          top: "max(0.75rem, env(safe-area-inset-top, 0px))",
          left: "50%",
          transform: "translateX(-50%)",
          minHeight: "var(--control)",
          borderRadius: "var(--radius-m)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-cream)",
          fontSize: "var(--text-small)",
          fontWeight: 600,
        }}
      >
        <CameraIcon className="w-4 h-4" />
        {images.length}
      </button>
      {open && (
        <Sheet title="Kamerabilder" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable host; not an asset next/image can optimize
              <img key={i} src={src} alt={`Kamerabilde ${i + 1} fra brettet`} className="rounded w-full h-auto" style={{ border: "1px solid var(--color-border)" }} />
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
