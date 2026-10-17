"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A QR code for some text, drawn as an SVG in black on white — the contrast a phone camera needs,
 * whatever the theme around it. Built on the page, so it works offline once the page has loaded.
 */
export function QrCode({ text, size = 176, label }: { text: string; size?: number; label: string }) {
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch {
      return null;
    }
  }, [text]);

  if (!svg) return null;
  return (
    <div role="img" aria-label={label} className="rounded-xl bg-white p-3" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
