import { ImageResponse } from "next/og";
import { dartIcon } from "@/lib/dartIcon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(dartIcon({ rounded: true }), size);
}
