"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deletePlayer, renameTeam, useRoster, useRosterLoaded } from "@/lib/storage";
import { buildSeedTable, formOf, type FormInfo } from "@/lib/seedingTable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PhotoButton } from "@/components/PhotoButton";
import { TEAM_NAME_MAX } from "@/lib/teamNames";
import { ScreenTop } from "@/components/ScreenTop";
import { SoundClipButton } from "@/components/SoundClipButton";
import { PlayerKitEditor, TeamKitEditor, WalkOnPicker } from "@/components/KitSettings";
import { TeamKit } from "@/components/TeamKit";
import { teamKitsOf } from "@/lib/storage";
import { TrashIcon } from "@/components/icons";

const RULES = { target: 3, ringChoice: true };
const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";
const FORM_COLOR: Record<FormInfo["label"], string> = { "På gang": "var(--color-green)", Jevn: "var(--color-cream)", Svak: "var(--color-red)", "For få kamper": "var(--color-muted)" };

/** A name from the address, which may already be decoded and hold a percent sign: that must not throw. */
function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function Dots({ results }: { results: boolean[] }) {
  const pad = Math.max(0, 10 - results.length);
  return (
    <span className="inline-flex gap-1" aria-label={results.map((r) => (r ? "seier" : "tap")).join(", ")}>
      {Array.from({ length: pad }).map((_, i) => (
        <i key={`p${i}`} style={{ width: 12, height: 12, borderRadius: 999, border: "1px solid var(--color-border)", display: "block" }} />
      ))}
      {results.map((r, i) => (
        <i key={i} style={{ width: 12, height: 12, borderRadius: 999, background: r ? "var(--color-green)" : "var(--color-red)", display: "block" }} />
      ))}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cell-tile rounded-lg p-3 text-center flex flex-col justify-center" style={{ minHeight: "4.5rem" }}>
      <p style={{ color: "var(--color-muted)", fontSize: "0.75rem", letterSpacing: "0.05em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "1.15rem", fontWeight: 700 }}>
        {children}
      </p>
    </div>
  );
}

/** One player, or one team, as a card like the one before a match: the name, the picture, where they stand in the
 *  seeding and how they are in form. The sound clip is here too, and the one place they can be deleted — away from
 *  the list, where a bin beside every name was easy to hit. Every other number is on Statistikk. */
export default function PlayerDetailPage() {
  const params = useParams<{ navn: string }>();
  const router = useRouter();
  const name = safeDecode(params.navn ?? "");
  const roster = useRoster();
  const loaded = useRosterLoaded();
  const player = roster.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const seed = useMemo(() => (player && player.kind !== "team" ? buildSeedTable(roster, RULES).find((r) => r.name === player.name) ?? null : null), [roster, player]);

  if (!player) {
    return (
      <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
        <div className="screen-inner">
          <ScreenTop title="Spiller" backHref="/spillere" backLabel="← Tilbake" />
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            {loaded ? `Fant ikke «${name}»` : "Henter …"}
          </p>
        </div>
      </div>
    );
  }

  const isTeam = player.kind === "team";
  const form = seed?.form ?? formOf(player);
  const teams = isTeam ? [] : roster.filter((r) => r.kind === "team" && (r.members ?? []).some((m) => m.toLowerCase() === player.name.toLowerCase()));

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop
          title={isTeam ? "Lag" : "Spiller"}
          backHref="/spillere"
          backLabel="← Tilbake"
          right={
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Slett ${player.name}`}
              className={`tactile rounded-lg flex items-center justify-center ${FOCUS_RING}`}
              style={{ width: "2.75rem", height: "2.75rem", background: "var(--color-surface)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          }
        />

        {confirmingDelete && (
          <ConfirmDialog
            message={`Slette ${player.name}? Statistikken slettes også, og det kan ikke angres.`}
            buttons={[
              { label: "Nei, behold", onClick: () => setConfirmingDelete(false), background: "var(--color-green)" },
              {
                label: "Ja, slett",
                onClick: () => {
                  deletePlayer(player.name);
                  router.push("/spillere");
                },
                background: "var(--color-red)",
              },
            ]}
          />
        )}

        <div className="shadow-panel rounded-2xl p-5 mb-4 text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex justify-center mb-3">
            <PhotoButton name={player.name} photo={player.photo} />
          </div>
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "2rem", lineHeight: 1.1 }}>
            {player.name}
          </h1>
          <div className="flex justify-center mt-2">
            <TeamKit kit={teamKitsOf(player).home} size={44} title="Drakt" />
          </div>
          {isTeam && (
            <p className="mt-1" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
              {(player.members ?? []).map((m, i) => (
                <span key={m}>
                  {i > 0 && ", "}
                  <Link href={`/spillere/${encodeURIComponent(m)}`} className={`underline ${FOCUS_RING}`} style={{ color: "var(--color-cream)" }}>
                    {m}
                  </Link>
                </span>
              ))}
            </p>
          )}

          <div className={`grid gap-2 mt-4 ${seed ? "grid-cols-3" : "grid-cols-2"}`}>
            {seed && <Fact label="SEEDING">{seed.rank}.</Fact>}
            {seed && <Fact label="RATING">{Math.round(seed.rating)}</Fact>}
            <Fact label="KAMPER">
              {player.matchesWon}–{player.matchesPlayed - player.matchesWon}
            </Fact>
          </div>

          <div className="mt-4 rounded-lg p-3" style={{ background: "var(--color-cell)" }}>
            <p className="section-label mb-2" style={{ fontSize: "0.75rem" }}>
              FORM · SISTE 10
            </p>
            <div className="flex items-center justify-center gap-3">
              <Dots results={form.results} />
              <span style={{ color: FORM_COLOR[form.label], fontWeight: 700 }}>{form.label}</span>
            </div>
          </div>
        </div>

        {/* The shirts and the tune a team walks on to. */}
        {isTeam && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">DRAKTER OG INNMARSJ</p>
            <TeamKitEditor team={player} />
          </div>
        )}

        {/* A team can be called anything — it does not have to be its players' names. */}
        {isTeam && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <label htmlFor="rename-team" className="mb-2 section-label block">
              LAGNAVN
            </label>
            <div className="flex gap-2">
              <input
                id="rename-team"
                value={newName ?? player.name}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNameError("");
                }}
                maxLength={TEAM_NAME_MAX}
                className={`flex-1 min-w-0 px-4 rounded-lg ${FOCUS_RING}`}
                style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
              />
              <button
                type="button"
                disabled={newName === null || newName.trim() === player.name}
                onClick={() => {
                  const result = renameTeam(player.name, newName ?? "");
                  if (!result.ok) {
                    setNameError(result.error);
                    return;
                  }
                  setNewName(null);
                  router.replace(`/spillere/${encodeURIComponent(result.name)}`);
                }}
                className={`glossy px-4 rounded-lg font-medium ${FOCUS_RING}`}
                style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "2.75rem" } as React.CSSProperties}
              >
                Lagre
              </button>
            </div>
            {nameError && (
              <p role="alert" className="mt-2" style={{ color: "var(--color-red)", fontSize: "0.75rem" }}>
                {nameError}
              </p>
            )}
          </div>
        )}

        {/* The teams this player is in. */}
        {teams.length > 0 && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">LAG</p>
            <div className="space-y-2">
              {teams.map((t) => (
                <Link
                  key={t.name}
                  href={`/spillere/${encodeURIComponent(t.name)}`}
                  className={`tactile flex items-center justify-between gap-2 px-4 rounded-lg ${FOCUS_RING}`}
                  style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                    {t.matchesWon} av {t.matchesPlayed} {t.matchesPlayed === 1 ? "kamp" : "kamper"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* A clip plays when it becomes someone's turn; in a team that is a member's turn, so a team has none. */}
        {!isTeam && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">LYDKLIPP</p>
            <SoundClipButton name={player.name} />
          </div>
        )}
        {!isTeam && (
          <div className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
            <p className="mb-4 section-label">DRAKT OG INNMARSJ</p>
            <WalkOnPicker record={player} />
            <PlayerKitEditor player={player} />
          </div>
        )}

        <Link href="/statistikk" className={`tactile block text-center rounded-lg ${FOCUS_RING}`} style={{ lineHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
          Se statistikken ›
        </Link>
      </div>
    </div>
  );
}
