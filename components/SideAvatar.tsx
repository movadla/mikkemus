import { firstKit } from "@/lib/teamKit";
import type { SideMember } from "@/lib/teamGame";
import { TeamKit } from "./TeamKit";
import { Avatar } from "./ui/Avatar";

/** The face of a side: a player's own, or a team's shirt (the one its people would wear). */
export function SideAvatar({ name, roster, photo, px = 44, state, bot }: { name: string; roster?: SideMember[]; photo?: string | null; px?: number; state?: "idle" | "active" | "winner"; bot?: boolean }) {
  if (roster && roster.length > 0) return <TeamKit kit={firstKit(roster.map((m) => m.name))} size={px} title={name} />;
  return <Avatar name={name} photo={photo} px={px} state={state} bot={bot} />;
}
