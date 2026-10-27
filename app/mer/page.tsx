"use client";

import { useAccess } from "@/lib/access";
import { ScreenTop } from "@/components/ScreenTop";
import { BookIcon, CoinIcon, LogOutIcon, SettingsIcon, TvIcon } from "@/components/icons";
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
        <div className="grid gap-2 md:grid-cols-2">
          <Row leading={<SettingsIcon className={icon} />} title="Innstillinger" subtitle={`${FX_LABELS[fx]} · ${theme === "auto" ? "Auto" : theme === "dark" ? "Mørk" : "Dag"}`} href="/innstillinger" />
          <Row leading={<BookIcon className={icon} />} title="Regler" subtitle="Slik spilles kampene" href="/?m=regler" />
          {!limited && <Row leading={<CoinIcon className={icon} />} title="Spill på morro" subtitle="Tipp vinneren mens kampen pågår" href="/bet" />}
          {!limited && <Row leading={<TvIcon className={icon} />} title="Storskjerm" subtitle="Kampen, trekningen og mesteren i stort format" href="/storskjerm" />}
        </div>
        {/* A way out, where it is found: log out and type the other code to see the app as someone with it does. */}
        <div className="mt-6 md:max-w-sm">
          <Row leading={<LogOutIcon className={icon} />} title="Logg ut" subtitle={`Du er inne med ${level === "limited" ? "den begrensede koden" : "hele koden"}`} onClick={forgetDevice} />
        </div>
      </div>
    </div>
  );
}
