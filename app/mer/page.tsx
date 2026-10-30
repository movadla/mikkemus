"use client";

import { useAccess } from "@/lib/access";
import { ScreenTop } from "@/components/ScreenTop";
import { BookIcon, CoinIcon, LogOutIcon, MedalIcon, SettingsIcon, TvIcon } from "@/components/icons";
import { Row } from "@/components/ui/Row";
import { FX_LABELS, useFxLevel } from "@/lib/fxLevel";
import { forgetDevice } from "@/lib/pin";
import { useThemeChoice } from "@/lib/theme";

const icon = "w-5 h-5";

/** Mer: what is not a game and not a list of players: the rules, the betting game, the big screen and the settings. */
export default function MorePage() {
  const { limited, level } = useAccess();
  const fx = useFxLevel();
  const theme = useThemeChoice();
  return (
    <div className="animate-screen-enter screen">
      <div className="screen-inner wide">
        <ScreenTop title="Mer" />
        <div className="group-list md:max-w-xl">
          <Row leading={<MedalIcon className={icon} />} title="Kveldsscore" subtitle="Poeng og kamper i kveld" href="/kveld" plain />
          <Row leading={<SettingsIcon className={icon} />} title="Innstillinger" subtitle={`${FX_LABELS[fx]} · ${theme === "auto" ? "Auto" : theme === "dark" ? "Mørk" : "Dag"}`} href="/innstillinger" plain />
          <Row leading={<BookIcon className={icon} />} title="Regler" subtitle="Slik spilles kampene" href="/?m=regler" plain />
          {!limited && <Row leading={<CoinIcon className={icon} />} title="Spill på morro" subtitle="Tipp vinneren" href="/bet" plain />}
          {!limited && <Row leading={<TvIcon className={icon} />} title="Storskjerm" subtitle="Kamp og turnering i stort format" href="/storskjerm" plain />}
        </div>
        {/* A way out, where it is found: log out and type the other code to see the app as someone with it does. */}
        <div className="group-list mt-4 md:max-w-xl">
          <Row leading={<LogOutIcon className={icon} />} title="Logg ut" subtitle={`Du er inne med ${level === "limited" ? "den begrensede koden" : "hele koden"}`} onClick={forgetDevice} plain />
        </div>
      </div>
    </div>
  );
}
