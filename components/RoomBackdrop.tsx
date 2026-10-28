/* eslint-disable @next/next/no-img-element -- one fixed picture of the room, from public/career */
import type { ReactNode } from "react";
import { roomPicture } from "@/lib/career";

/**
 * The room behind a screen: the picture of the step the room is at, cut to fill the whole screen, with a dark layer over it and a soft blur, so
 * that what is written on top can be read. It drifts a little, as if the camera were breathing. Everything a player does at home happens in front
 * of it, so the money spent shows every time they play.
 */
export function RoomBackdrop({ stage, dim = 55, blur = 0 }: { stage: number; /** How dark the layer over the picture is, 0 to 100. */ dim?: number; /** Blur, in px. */ blur?: number }) {
  return (
    <div className="room-backdrop" aria-hidden style={{ "--dim": dim, "--blur": `${blur}px` } as React.CSSProperties}>
      <img key={stage} src={roomPicture(stage)} alt="" className="room-backdrop-img" />
      <div className="room-backdrop-shade" />
      <div className="room-backdrop-light" />
    </div>
  );
}

/** A screen of the career laid over the room: the picture behind, the screen in front. */
export function OverRoom({ stage, dim, blur, children }: { stage: number; dim?: number; blur?: number; children: ReactNode }) {
  return (
    <>
      <RoomBackdrop stage={stage} dim={dim} blur={blur} />
      <div className="room-over">{children}</div>
    </>
  );
}
