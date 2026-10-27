"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WinnerScreen } from "@/components/WinnerScreen";
import { ScreenTop } from "@/components/ScreenTop";
import { whenLabel } from "@/lib/formatDate";
import { loadMatchArchive, type MatchArchive } from "@/lib/matchArchive";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { getRules, restoreRules, setGameVariant } from "@/lib/rules";

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const when = whenLabel;

/** An old match, with every number about it: the page the match ended on, as it looked then. */
export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = safeDecode(params.id);
  // undefined: loading; null: there is no such match.
  const [loaded, setLoaded] = useState<{ id: string; archive: MatchArchive | null } | null>(null);
  // Nothing yet for this id (a new one after another match): loading, not the match before.
  const archive = loaded && loaded.id === id ? loaded.archive : undefined;

  useEffect(() => {
    let cancelled = false;
    const before = getRules();
    void loadMatchArchive(id).then((a) => {
      if (cancelled) return;
      // The rules of that match (how many crosses a row takes) are read from here while the page is drawn.
      if (a) setGameVariant(a.variant);
      setLoaded({ id, archive: a });
    });
    return () => {
      cancelled = true;
      // The rest of the app plays by the rules it had.
      restoreRules(before);
    };
  }, [id]);

  if (archive === undefined || archive === null) {
    return (
      <div className="animate-screen-push screen">
        <div className="screen-inner">
          <ScreenTop title="Kamp" backHref="/statistikk" />
          {archive === undefined ? <SkeletonRows count={3} /> : <EmptyState title="Fant ikke kampen" />}
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="fixed top-2 inset-x-0 text-center z-50 pointer-events-none tabular" style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", textShadow: "0 1px 4px #000" }}>
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
