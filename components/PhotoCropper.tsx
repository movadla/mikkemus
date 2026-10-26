"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_ZOOM, MIN_ZOOM, clampView, cropRect, normalizeLevels, scaleOf, type CropView } from "@/lib/photoCrop";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";
import { SwitchRow } from "./ui/Switch";

/** The side of the round window on the screen, in pixels, and of the picture that comes out of it. */
const WINDOW = 260;
const OUT = 480;

/**
 * Cropping a portrait after it has been chosen: the picture sits behind a round window, to be dragged and zoomed until the face is where
 * it should be, and «Lys» (on to begin with) lifts a dark picture and dims a bright one so pictures from different phones and rooms sit
 * alike. What comes out is a square picture of its own, ready to be shown in the round frame everywhere.
 */
export function PhotoCropper({ file, onDone, onCancel }: { file: File; onDone: (dataUrl: string) => void; onCancel: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, x: 0, y: 0 });
  const [lift, setLift] = useState(true);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // The answers of a picture that was let go of (the effect runs twice in development, and again for a new file) are not read.
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      imgRef.current = img;
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      setSrc(url);
    };
    img.onerror = () => {
      if (live) setFailed(true);
    };
    img.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const move = (next: CropView) => size && setView(clampView(size.w, size.h, next, WINDOW));

  function confirm() {
    const img = imgRef.current;
    if (!img || !size) return;
    const r = cropRect(size.w, size.h, view, WINDOW);
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, r.sx, r.sy, r.size, r.size, 0, 0, OUT, OUT);
    if (lift) {
      const data = ctx.getImageData(0, 0, OUT, OUT);
      normalizeLevels(data.data);
      ctx.putImageData(data, 0, 0);
    }
    onDone(canvas.toDataURL("image/jpeg", 0.86));
  }

  const scale = size ? scaleOf(size.w, size.h, view.zoom, WINDOW) : 1;
  return (
    <Sheet title="Beskjær bildet" onClose={onCancel}>
      {failed ? (
        <p className="mb-4" style={{ color: "var(--color-red)", fontSize: "var(--text-body)" }} role="alert">
          Kunne ikke lese bildet.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            role="img"
            aria-label="Bildet i det runde vinduet. Dra for å flytte det, og bruk glidebryteren for å zoome."
            className="relative rounded-full overflow-hidden select-none"
            style={{ width: WINDOW, height: WINDOW, background: "var(--color-cell)", border: "3px solid var(--color-hairline)", touchAction: "none", cursor: "grab" }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x;
              const dy = e.clientY - drag.current.y;
              drag.current = { x: e.clientX, y: e.clientY };
              move({ ...view, x: view.x + dx, y: view.y + dy });
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => move({ ...view, zoom: view.zoom - e.deltaY * 0.002 })}
          >
            {src && size && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                draggable={false}
                style={{ position: "absolute", maxWidth: "none", width: size.w * scale, height: size.h * scale, left: WINDOW / 2 - (size.w * scale) / 2 + view.x, top: WINDOW / 2 - (size.h * scale) / 2 + view.y, filter: lift ? "brightness(1.02) contrast(1.02)" : undefined }}
              />
            )}
          </div>
          <label className="w-full flex items-center gap-3" style={{ color: "var(--color-text-2)", fontSize: "var(--text-small)" }}>
            Zoom
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              onChange={(e) => move({ ...view, zoom: Number(e.target.value) })}
              className="flex-1"
              style={{ accentColor: "var(--color-teal)", minHeight: "var(--control)" }}
            />
          </label>
          <div className="w-full">
            <SwitchRow label="Lys" hint="Lyser opp mørke bilder og demper lyse, så bildene ser like ut" checked={lift} onChange={setLift} />
          </div>
          <div className="w-full flex gap-2">
            <Button block onClick={onCancel}>
              Avbryt
            </Button>
            <Button block variant="primary" onClick={confirm} disabled={!src}>
              Bruk bildet
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
