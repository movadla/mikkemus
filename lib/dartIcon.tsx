import { brandIconSvg } from "./brandIconSvg";

/** The app's icon, for ImageResponse: the brand symbol (lib/brandIconSvg.ts) drawn as an image the size of the icon. */
export function dartIcon(opts: { rounded?: boolean; safe?: boolean } = {}) {
  const src = `data:image/svg+xml;base64,${Buffer.from(brandIconSvg(opts)).toString("base64")}`;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not shown in a page */}
      <img src={src} alt="" width="100%" height="100%" />
    </div>
  );
}
