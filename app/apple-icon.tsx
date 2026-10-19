import { ImageResponse } from "next/og";
import { dartIcon } from "@/lib/dartIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS cuts the corners itself, so the picture runs to the edges.
export default function AppleIcon() {
  return new ImageResponse(dartIcon(), size);
}
