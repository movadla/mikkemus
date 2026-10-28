/* eslint-disable @next/next/no-img-element -- small fixed pictures of the room, from public/career */
import { roomPicture } from "@/lib/career";

/**
 * The picture of the room at a step. When `from` is given the room has just changed: the old picture stays underneath and the new one comes in
 * over it, so a purchase is seen happening. Same size and same view on every step, so the pictures lie exactly over each other.
 */
export function RoomPicture({ stage, from, alt, className = "" }: { stage: number; from?: number | null; alt: string; className?: string }) {
  const changing = from !== undefined && from !== null && from !== stage;
  return (
    <div className={`room-picture ${className}`}>
      {changing && <img src={roomPicture(from)} alt="" aria-hidden className="room-picture-img" />}
      <img key={stage} src={roomPicture(stage)} alt={alt} className={`room-picture-img ${changing ? "room-fade-in" : ""}`} />
      {changing && <span className="room-flash" aria-hidden />}
    </div>
  );
}
