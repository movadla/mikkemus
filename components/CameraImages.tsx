"use client";

type Props = { images: string[] };

/**
 * Renders whatever image-like references were found in the payload (see
 * lib/extractImageUrls.ts), and quietly renders nothing when there were none. Confirmed
 * against real board output 2026-09-07: three base64 JPEGs, one per camera, per takeout.
 */
export function CameraImages({ images }: Props) {
  if (images.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex gap-2 p-2 rounded-lg shadow-panel"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable host; not an asset next/image can optimize
        <img
          key={i}
          src={src}
          alt="Kamerabilde fra brettet"
          className="rounded h-20 w-auto"
          style={{ border: "1px solid var(--color-border)" }}
        />
      ))}
    </div>
  );
}
