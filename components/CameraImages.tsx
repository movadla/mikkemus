"use client";

type Props = { images: string[] };

/**
 * Best-effort only. Scolia's CAMERA_IMAGES payload shape isn't documented (see
 * lib/extractImageUrls.ts) and the board this app talks to has been offline throughout
 * development, so this has never been verified against a real payload — it renders whatever
 * image-like references were found, and quietly renders nothing when none were.
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
