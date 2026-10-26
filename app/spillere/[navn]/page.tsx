"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccess } from "@/lib/access";
import { useEffect, useMemo, useState } from "react";
import { listFinishedTournaments } from "@/lib/tournamentStorage";
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
import { EditIcon, TrashIcon } from "@/components/icons";
import { avatarAccent } from "@/lib/avatarAccent";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Row } from "@/components/ui/Row";
import { Section } from "@/components/ui/Section";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonRows } from "@/components/ui/Skeleton";

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
      <p style={{ color: "var(--color-muted)", fontSize: "var(--text-micro)", letterSpacing: "0.05em" }}>{label}</p>
      <p className="tabular" style={{ color: "var(--color-cream)", fontSize: "var(--text-title)", fontWeight: 700 }}>
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
  const [editing, setEditing] = useState(false);
  // The limited code deletes no player or team, and sees no seeding, rating, record or form.
  const { limited } = useAccess();
  const [newName, setNewName] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  // Cups won, from the trophy cabinet (finished tournaments).
  const [cups, setCups] = useState(0);
  useEffect(() => {
    if (limited) return;
    let live = true;
    void listFinishedTournaments().then((list) => {
      if (live) setCups(list.filter((t) => t.winner?.toLowerCase() === name.toLowerCase()).length);
    });
    return () => {
      live = false;
    };
  }, [limited, name]);
  const seed = useMemo(() => (player && player.kind !== "team" ? buildSeedTable(roster, RULES).find((r) => r.name === player.name) ?? null : null), [roster, player]);

  if (!player) {
    return (
      <div className="animate-screen-push screen" style={{ background: "var(--color-bg)" }}>
        <div className="screen-inner">
          <ScreenTop title="Spiller" backHref="/spillere" />
          {loaded ? <EmptyState title={`Fant ikke «${name}»`} /> : <SkeletonRows count={2} />}
        </div>
      </div>
    );
  }

  const isTeam = player.kind === "team";
  const form = seed?.form ?? formOf(player);
  const teams = isTeam ? [] : roster.filter((r) => r.kind === "team" && (r.members ?? []).some((m) => m.toLowerCase() === player.name.toLowerCase()));

  return (
    <div className="animate-screen-push screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop
          title={player.name}
          backHref="/spillere"
          right={<Button label={`Rediger ${player.name}`} icon={<EditIcon className="w-5 h-5" />} onClick={() => setEditing(true)} />}
        />

        {confirmingDelete && (
          <ConfirmDialog
            message={`Slette ${player.name}? Statistikken slettes også, og det kan ikke angres.`}
            buttons={[
              { label: "Behold", onClick: () => setConfirmingDelete(false), background: "var(--color-green)" },
              {
                label: "Slett",
                onClick: () => {
                  deletePlayer(player.name);
                  router.push("/spillere");
                },
                background: "var(--color-red)",
              },
            ]}
          />
        )}

        {editing && (
          <Sheet title="Rediger" onClose={() => setEditing(false)}>
            <div className="space-y-5">
              <div className="flex justify-center">
                <PhotoButton name={player.name} photo={player.photo} />
              </div>

              {/* A team can be called anything — it does not have to be its players' names. */}
              {isTeam && (
                <div>
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
                      className={`flex-1 min-w-0 px-4 ${FOCUS_RING}`}
                      style={{ minHeight: "var(--control)", borderRadius: "var(--radius-s)", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                    />
                    <Button
                      variant="primary"
                      disabled={newName === null || newName.trim() === player.name}
                      onClick={() => {
                        const result = renameTeam(player.name, newName ?? "");
                        if (!result.ok) {
                          setNameError(result.error);
                          return;
                        }
                        setNewName(null);
                        setEditing(false);
                        router.replace(`/spillere/${encodeURIComponent(result.name)}`);
                      }}
                    >
                      Lagre
                    </Button>
                  </div>
                  {nameError && (
                    <p role="alert" className="mt-2" style={{ color: "var(--color-red)", fontSize: "var(--text-micro)" }}>
                      {nameError}
                    </p>
                  )}
                </div>
              )}

              {/* The shirts and the tune a team walks on to. */}
              {isTeam && (
                <div>
                  <p className="mb-3 section-label">DRAKTER OG INNMARSJ</p>
                  <TeamKitEditor team={player} />
                </div>
              )}

              {/* A clip plays when it becomes someone's turn; in a team that is a member's turn, so a team has none. */}
              {!isTeam && (
                <div>
                  <p className="mb-3 section-label">LYDKLIPP</p>
                  <SoundClipButton name={player.name} />
                </div>
              )}
              {!isTeam && (
                <div>
                  <p className="mb-3 section-label">DRAKT OG INNMARSJ</p>
                  <WalkOnPicker record={player} />
                  <PlayerKitEditor player={player} />
                </div>
              )}

              {!limited && (
                <Button
                  variant="danger"
                  block
                  icon={<TrashIcon className="w-4 h-4" />}
                  onClick={() => {
                    setEditing(false);
                    setConfirmingDelete(true);
                  }}
                >
                  Slett
                </Button>
              )}
            </div>
          </Sheet>
        )}

        <div className="shadow-panel p-5 mb-6 text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-l)" }}>
          <div className="flex justify-center mb-3">
            <span className="rounded-full overflow-hidden flex items-center justify-center" style={{ width: "6rem", height: "6rem", background: "var(--color-cell)", border: "2px solid " + avatarAccent(player.name) }}>
              {player.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display" style={{ color: avatarAccent(player.name), fontSize: "var(--text-num)" }}>
                  {player.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-center">
            <TeamKit kit={teamKitsOf(player).home} size={44} title="Drakt" />
          </div>
          {isTeam && (
            <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
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

          {!limited && (
            <>
              <div className={`grid gap-2 mt-4 ${(seed ? 3 : 2) + (cups > 0 ? 1 : 0) === 4 ? "grid-cols-2" : seed ? "grid-cols-3" : "grid-cols-2"}`}>
                {cups > 0 && <Fact label="POKALER">{cups}</Fact>}
                {seed && <Fact label="SEEDING">{seed.rank}.</Fact>}
                {seed && <Fact label="RATING">{Math.round(seed.rating)}</Fact>}
                <Fact label="KAMPER">
                  {player.matchesWon}–{player.matchesPlayed - player.matchesWon}
                </Fact>
              </div>

              <div className="mt-4 p-3" style={{ background: "var(--color-cell)", borderRadius: "var(--radius-s)" }}>
                <p className="section-label mb-2">FORM · SISTE 10</p>
                <div className="flex items-center justify-center gap-3">
                  <Dots results={form.results} />
                  <span style={{ color: FORM_COLOR[form.label], fontWeight: 700 }}>{form.label}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* The teams this player is in. */}
        {teams.length > 0 && (
          <Section label="Lag">
            <div className="space-y-2">
              {teams.map((t) => (
                <Row key={t.name} href={`/spillere/${encodeURIComponent(t.name)}`} title={t.name} value={`${t.matchesWon} av ${t.matchesPlayed}`} />
              ))}
            </div>
          </Section>
        )}

        {!limited && (
          <Button href="/statistikk" block>
            Statistikk
          </Button>
        )}
      </div>
    </div>
  );
}
