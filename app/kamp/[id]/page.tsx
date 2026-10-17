"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WinnerScreen } from "@/components/WinnerScreen";
import { ScreenTop } from "@/components/ScreenTop";
import { loadMatchArchive, type MatchArchive } from "@/lib/matchArchive";
import { setGameVariant } from "@/lib/rules";

const two = (n: number) => String(n).padStart(2, "0");
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** An old match, with every number about it: the page the match ended on, as it looked then. */
export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id);
  // undefined: loading; null: there is no such match.
  const [archive, setArchive] = useState<MatchArchive | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadMatchArchive(id).then((a) => {
      if (cancelled) return;
      // The rules of that match (how many crosses a row takes) are read from here while the page is drawn.
      if (a) setGameVariant(a.variant);
      setArchive(a);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (archive === undefined || archive === null) {
    return (
      <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
        <div className="screen-inner">
          <ScreenTop title="Kamp" backHref="/statistikk" backLabel="← Statistikk" />
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            {archive === undefined ? "Henter kampen …" : "Fant ikke kampen. Den ble ikke lagret i full visning."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="fixed top-2 inset-x-0 text-center z-50 pointer-events-none tabular" style={{ color: "var(--color-muted)", fontSize: "0.75rem", textShadow: "0 1px 4px #000" }}>
        Kamp fra {when(archive.date)}
      </p>
      <WinnerScreen
        archive
        winner={archive.winner}
        players={archive.players}
        stats={archive.stats}
        luckByPlayer={archive.luck}
        preBankedByPlayer={archive.preBanked}
        throwsByPlayer={archive.throws}
        turnLogByPlayer={archive.turnLog}
        progressByPlayer={archive.progress}
        oddsHistory={archive.odds}
        onHome={() => router.push("/statistikk")}
        homeLabel="Tilbake til statistikken"
      />
    </>
  );
}
