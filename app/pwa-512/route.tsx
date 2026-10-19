import { ImageResponse } from "next/og";
import { dartIcon } from "@/lib/dartIcon";

export function GET() {
  return new ImageResponse(dartIcon({ rounded: true }), { width: 512, height: 512 });
}
