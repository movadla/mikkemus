import { ImageResponse } from "next/og";
import { dartIcon } from "@/lib/dartIcon";

// For launchers that cut the icon to their own shape: full-bleed, with the drawing inside the safe zone.
export function GET() {
  return new ImageResponse(dartIcon({ safe: true }), { width: 512, height: 512 });
}
