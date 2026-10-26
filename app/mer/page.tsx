"use client";

import { useAccess } from "@/lib/access";
import { ScreenTop } from "@/components/ScreenTop";
import { BookIcon, CoinIcon, SettingsIcon, TvIcon } from "@/components/icons";
import { Row } from "@/components/ui/Row";

const icon = "w-5 h-5";

/** Mer: what is not a game and not a list of players: the rules, the betting game, the big screen and the settings. */
export default function MorePage() {
  const { limited } = useAccess();
  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Mer" />
        <div className="space-y-2">
          <Row leading={<BookIcon className={icon} />} title="Regler" href="/?m=regler" />
          {!limited && <Row leading={<CoinIcon className={icon} />} title="Spill på morro" href="/bet" />}
          {!limited && <Row leading={<TvIcon className={icon} />} title="Storskjerm" href="/storskjerm" />}
          <Row leading={<SettingsIcon className={icon} />} title="Innstillinger" href="/innstillinger" />
        </div>
      </div>
    </div>
  );
}
