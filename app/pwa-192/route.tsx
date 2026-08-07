import { ImageResponse } from "next/og";
import { dartIcon } from "@/lib/dartIcon";

export function GET() {
  return new ImageResponse(dartIcon(), { width: 192, height: 192 });
}
