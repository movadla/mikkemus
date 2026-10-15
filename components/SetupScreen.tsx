"use client";

import { useRef, useState } from "react";
import { ensurePlayer, getPlayerRecord, setPlayerPhoto, setPlayerSound, useRosterNames } from "@/lib/storage";
import { reportError } from "@/lib/errorReporting";
import { BOT_LEVELS, BOT_LEVEL_PICKABLE, botDisplayName, botLevelBadge, type BotLevel, type TeamMember } from "@/lib/botLevels";
import { avatarAccent } from "@/lib/avatarAccent";
import { botsSupported, withStandRule, type GameVariant } from "@/lib/rules";
import { rememberTeamNames, resolveTeams, teamNameProblems } from "@/lib/teamNames";
import { rememberTeamCards } from "@/lib/teamCards";
import { markPlayersUsed } from "@/lib/recentPlayers";
import { CameraIcon, GuestIcon, MicIcon, PeopleIcon, PersonIcon } from "./icons";
import { PeoplePicker, type Person } from "./PeoplePicker";
import { PrimaryActionButton } from "./PrimaryActionButton";
import { RulesPicker } from "./RulesPicker";
import { FxPicker } from "./FxPicker";
import { RosterPills } from "./RosterPills";
import { SavedTeams, useTeamCard } from "./SavedTeams";
import { TeamComposer, isTeamSetupReady, type Team } from "./TeamComposer";

const RECORDING_MS = 2000;

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export function SetupScreen({
  onStart,
  onHome,
  title = "Enkeltkamp",
  variantSelectable = true,
}: {
  onStart: (
    players: string[],
    botLevels: Record<string, BotLevel>,
    teamRosters?: Record<string, TeamMember[]>,
    guestPlayers?: Record<string, true>,
    variant?: GameVariant
  ) => void;
  onHome?: () => void;
  /** Overridden by other modes (e.g. Bull-duell) that reuse this same player picker. */
  title?: React.ReactNode;
  /** Whether the Standard / 1 treff choice is offered — Bull-duell has its own game and hides it. */
  variantSelectable?: boolean;
}) {
  const [mode, setMode] = useState<"individual" | "team">("individual");
  const [variant, setVariant] = useState<GameVariant>("standard");

  const [nameInput, setNameInput] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  // A guest plays a full match like anyone else, but is never persisted to the roster —
  // no ensurePlayer call when added, and excluded from stats at match end (see
  // MikkeMusApp's finalizeMatch), same exclusion mechanism bots and teams already use.
  const [guestPlayers, setGuestPlayers] = useState<Record<string, true>>({});
  const [addingAsGuest, setAddingAsGuest] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [error, setError] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const rosterNames = useRosterNames();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [hasSound, setHasSound] = useState<Record<string, boolean>>({});
  const [capturingFor, setCapturingFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lag mode: a separate, simpler pool (no photo/sound personalization — that's tied to a real
  // single player's own recorded identity, which doesn't make sense for a team name).
  const [teamPeople, setTeamPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([
    { name: "Lag 1", members: [] },
    { name: "Lag 2", members: [] },
  ]);

  function handleTeamPeopleChange(next: Person[]) {
    const removedNames = teamPeople.filter((p) => !next.some((n) => n.name === p.name)).map((p) => p.name);
    if (removedNames.length > 0) {
      setTeams((prev) => prev.map((t) => ({ ...t, members: t.members.filter((m) => !removedNames.includes(m)) })));
    }
    setTeamPeople(next);
  }

  const pickTeamCard = useTeamCard(teamPeople, teams, (nextPeople, nextTeams) => {
    setTeamPeople(nextPeople);
    setTeams(nextTeams);
  });

  // The longer games have no bots — see botsSupported. Bots already added when the length is
  // changed are not removed behind the user's back; the start button waits until they are.
  const botsAllowed = botsSupported(variant);
  const blockedBots = !botsAllowed && Object.keys(botLevels).length > 0;
  const blockedTeamBots = !botsAllowed && teamPeople.some((p) => p.isBot);
  const teamsReady = isTeamSetupReady(teamPeople, teams) && !blockedTeamBots;

  function startTeamGame() {
    if (!teamsReady) return;
    // The names the teams will actually play under: typed ones as typed, the rest built from
    // their members (or remembered for that pair). Checked again here rather than trusted from
    // the button, since two teams sharing a name would share one column on the board.
    const playing = resolveTeams(teams);
    if (!teamNameProblems(playing).every((p) => p === null)) return;
    rememberTeamNames(teams.map((t, i) => ({ ...t, name: playing[i].name })));
    rememberTeamCards(playing);
    markPlayersUsed(teamPeople.filter((p) => !p.isBot).map((p) => p.name));
    const teamRosters: Record<string, TeamMember[]> = {};
    playing.forEach((t) => {
      teamRosters[t.name] = t.members.map((name) => {
        const person = teamPeople.find((p) => p.name === name)!;
        return { name: person.name, isBot: person.isBot, botLevel: person.botLevel };
      });
    });
    onStart(
      playing.map((t) => t.name),
      {},
      teamRosters,
      undefined,
      variant
    );
  }

  function startIndividualGame() {
    // The people from this match come first in the list next time.
    markPlayersUsed(players.filter((p) => !botLevels[p] && !guestPlayers[p]));
    // The stand rule belongs to team play; a lone player has no one to hand over to.
    onStart(players, botLevels, undefined, guestPlayers, withStandRule(variant, false));
  }

  function addPlayer(name: string, isGuest: boolean) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (players.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" er allerede lagt til`);
      return;
    }
    if (isGuest) {
      setGuestPlayers((prev) => ({ ...prev, [trimmed]: true }));
      setPlayers((prev) => [...prev, trimmed]);
      setNameInput("");
      setError("");
      setAddingPlayer(false);
      return;
    }
    ensurePlayer(trimmed);
    setPlayers((prev) => [...prev, trimmed]);
    setNameInput("");
    setError("");
    setAddingPlayer(false);
    const record = getPlayerRecord(trimmed);
    if (record?.photo) {
      setPhotos((prev) => ({ ...prev, [trimmed]: record.photo! }));
    }
    if (record?.sound) {
      setHasSound((prev) => ({ ...prev, [trimmed]: true }));
    }
  }

  const availableRoster = rosterNames.filter(
    (n) => !players.some((p) => p.toLowerCase() === n.toLowerCase())
  );

  function removePlayer(name: string) {
    setPlayers((prev) => prev.filter((p) => p !== name));
    setBotLevels((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setGuestPlayers((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  /** Bots are never ensurePlayer'd — they're a virtual opponent, not a roster entry. */
  function addBot(level: BotLevel) {
    const base = botDisplayName(level);
    let name = base;
    let suffix = 2;
    while (players.some((p) => p.toLowerCase() === name.toLowerCase())) {
      name = `${base} (${suffix})`;
      suffix++;
    }
    setPlayers((prev) => [...prev, name]);
    setBotLevels((prev) => ({ ...prev, [name]: level }));
    setShowBotPicker(false);
  }

  /** Opens the OS picker for this player: camera or photo library, the user chooses. */
  function choosePhotoFor(name: string) {
    setCapturingFor(name);
    fileInputRef.current?.click();
  }

  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const player = capturingFor;
    e.target.value = "";
    if (!file || !player) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPlayerPhoto(player, dataUrl);
      setPhotos((prev) => ({ ...prev, [player]: dataUrl }));
    };
    reader.onerror = () => reportError("Kunne ikke lese bildet.", { key: "photo-read" });
    reader.readAsDataURL(file);
  }

  async function recordSoundFor(name: string) {
    if (recordingFor) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        // Busy indicator stays lit until the save actually finishes, not just until recording stops.
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setPlayerSound(name, dataUrl);
          setHasSound((prev) => ({ ...prev, [name]: true }));
          setRecordingFor(null);
        };
        reader.onerror = () => {
          reportError("Kunne ikke lagre lydklippet.", { key: "sound-save" });
          setRecordingFor(null);
        };
        reader.readAsDataURL(blob);
      };
      setRecordingFor(name);
      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, RECORDING_MS);
    } catch {
      setRecordingFor(null);
      reportError("Fikk ikke tilgang til mikrofonen.", { key: "mic-permission" });
    }
  }

  /** The name field with its Legg til/Avbryt — one piece of UI for a new roster player and for a
   *  guest, which differ only in what the field asks for. */
  function renderNameInput() {
    return (
      <div className="flex gap-2 mt-3">
        <input
          autoFocus
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && addPlayer(nameInput, addingAsGuest)}
          placeholder={addingAsGuest ? "Gjestens navn" : "Spillernavn"}
          className={`flex-1 min-w-0 px-4 py-3 rounded-lg ${FOCUS_RING}`}
          style={{
            background: "var(--color-surface)",
            color: "var(--color-cream)",
            border: "1px solid var(--color-border)",
          }}
        />
        <button
          type="button"
          onClick={() => addPlayer(nameInput, addingAsGuest)}
          className={`glossy px-5 py-3 rounded-lg font-medium ${FOCUS_RING}`}
          style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)" } as React.CSSProperties}
        >
          Legg til
        </button>
        <button
          type="button"
          onClick={() => {
            setAddingPlayer(false);
            setError("");
          }}
          aria-label="Avbryt"
          className={`tactile px-4 py-3 rounded-lg text-sm ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
        >
          Avbryt
        </button>
      </div>
    );
  }

  /** One of the three ways to put someone in the match. */
  const addButton = "tactile flex-1 px-3 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5";

  return (
    <div
      className="animate-screen-enter min-h-screen w-full flex items-start justify-center px-6 pb-10"
      // The top is left clear for the Scolia badge, which sits in the corner of every screen.
      style={{ background: "var(--color-bg)", paddingTop: "3.5rem" }}
    >
      {/* No `capture` attribute. With it, iOS opens the camera directly and offers no way to
          reach the photo library at all — so a picture you already have of someone was
          impossible to use. Without it the OS shows its normal sheet, which has both. */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
      <div className="w-full max-w-md">
        {/* The mascot and the big title that used to open every setup screen took the top fifth
            of the screen and pushed Start under the fold. The title is now one line beside Hjem. */}
        <div className="flex items-center justify-between mb-5">
          {onHome ? (
            <button
              type="button"
              onClick={onHome}
              className={`tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
              style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
            >
              ← Hjem
            </button>
          ) : (
            <span style={{ width: "72px" }} />
          )}
          <h1 className="font-display" style={{ color: "var(--color-cream)", fontSize: "1.7rem", letterSpacing: "0.02em" }}>
            {title}
          </h1>
          <span style={{ width: "72px" }} aria-hidden />
        </div>

        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode("individual")}
            className={`glossy flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={
              {
                "--btn-fill": mode === "individual" ? "var(--color-teal)" : "var(--color-surface)",
                color: mode === "individual" ? "var(--color-bg)" : "var(--color-cream)",
                border: "1px solid var(--color-border)",
              } as React.CSSProperties
            }
          >
            <PersonIcon className="w-4 h-4" />
            Individuelt
          </button>
          <button
            type="button"
            onClick={() => setMode("team")}
            className={`glossy flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${FOCUS_RING}`}
            style={
              {
                "--btn-fill": mode === "team" ? "var(--color-teal)" : "var(--color-surface)",
                color: mode === "team" ? "var(--color-bg)" : "var(--color-cream)",
                border: "1px solid var(--color-border)",
              } as React.CSSProperties
            }
          >
            <PeopleIcon className="w-4 h-4" />
            Lag
          </button>
        </div>

        {/* Which game. The second question, not the first — shared by both modes, with the
            stand rule offered only where a team has several members to alternate between. */}
        {variantSelectable && <RulesPicker variant={variant} onChange={setVariant} teamPlay={mode === "team"} />}
        {variantSelectable && <FxPicker />}

        {mode === "individual" && (
          <>
            {/* Earlier players first — only shown when there are any, so a new device does not
                open on an empty box. Search and clean-up live inside it. */}
            {availableRoster.length > 0 && (
              <div
                className="shadow-panel rounded-xl p-4 mb-4"
                style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}
              >
                <p className="section-label text-center mb-3">VELG FRA TIDLIGERE</p>
                <RosterPills names={availableRoster} onPick={(n) => addPlayer(n, false)} />
              </div>
            )}

            {/* The three ways to put someone in the match, side by side and always in view. They
                used to be a "+ Ny spiller" chip in one box and a "Legg til" button in another that
                opened a menu with two more. */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setAddingAsGuest(false);
                  setAddingPlayer(true);
                  setShowBotPicker(false);
                  setError("");
                }}
                className={`${addButton} ${FOCUS_RING}`}
                style={{ background: "var(--color-surface)", border: "1.5px dashed var(--color-teal)", color: "var(--color-teal)" }}
              >
                <span aria-hidden style={{ fontSize: "1.05rem", lineHeight: 1, fontWeight: 700 }}>
                  +
                </span>
                Ny spiller
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingAsGuest(true);
                  setAddingPlayer(true);
                  setShowBotPicker(false);
                  setError("");
                }}
                className={`${addButton} ${FOCUS_RING}`}
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-cream)" }}
              >
                <GuestIcon className="w-3.5 h-3.5" />
                Gjest
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingPlayer(false);
                  setShowBotPicker((v) => !v);
                }}
                disabled={!botsAllowed}
                title={botsAllowed ? undefined : "Boter spiller bare ved 1–3 treff per seksjon"}
                className={`${addButton} ${FOCUS_RING}`}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-cream)",
                  opacity: botsAllowed ? 1 : 0.4,
                }}
              >
                <span aria-hidden>🤖</span>
                Bot
              </button>
            </div>
            {addingPlayer && <div className="mb-4 -mt-1">{renderNameInput()}</div>}
            {showBotPicker && botsAllowed && (
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {BOT_LEVEL_PICKABLE.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => addBot(level)}
                    className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`}
                    style={{ background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                  >
                    {BOT_LEVELS[level].name} {botLevelBadge(level)}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p className="text-sm text-center mb-4" style={{ color: "var(--color-red)" }}>
                {error}
              </p>
            )}

            <div className="shadow-panel rounded-xl p-4 mb-8" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <p className="section-label text-center mb-3">
                DELTAKERE
              </p>
              <div className="space-y-2">
              {players.length === 0 && (
                <p className="text-center py-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                  Ingen deltakere ennå – velg over
                </p>
              )}
              {players.map((p, i) => {
                const level = botLevels[p];
                const isGuest = !!guestPlayers[p];
                return (
                  <div
                    key={p}
                    className="shadow-panel flex items-center justify-between px-4 py-3 rounded-lg"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <div className="flex items-center gap-3">
                      {level ? (
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "var(--color-cell)", border: "1.5px solid var(--color-border)" }}
                          aria-hidden
                        >
                          🤖
                        </span>
                      ) : isGuest ? (
                        // Guests have nothing to save a photo to, so this is a plain badge, not a button.
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: "var(--color-cell)",
                            border: "1.5px dashed var(--color-muted)",
                            color: "var(--color-muted)",
                          }}
                          aria-hidden
                        >
                          <GuestIcon className="w-4 h-4" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => choosePhotoFor(p)}
                          className={`tactile w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${FOCUS_RING}`}
                          style={{
                            background: "var(--color-cell)",
                            border: `1.5px solid ${avatarAccent(p)}`,
                            color: "var(--color-muted)",
                          }}
                          aria-label={`Velg bilde av ${p}`}
                        >
                          {photos[p] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photos[p]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <CameraIcon className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <span style={{ color: "var(--color-cream)" }}>
                        <span style={{ color: "var(--color-teal)", marginRight: "0.5rem" }}>{i + 1}.</span>
                        {p}
                        {isGuest && (
                          <span style={{ color: "var(--color-muted)", fontSize: "0.75rem", marginLeft: "0.4rem" }}>
                            (gjest)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {confirmingRemove === p ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              removePlayer(p);
                              setConfirmingRemove(null);
                            }}
                            className={`tactile px-3 py-1.5 rounded-lg text-sm font-medium ${FOCUS_RING}`}
                            style={{ background: "var(--color-cell)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}
                          >
                            Sikker?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRemove(null)}
                            className={`tactile px-3 py-1.5 rounded-lg text-sm ${FOCUS_RING}`}
                            style={{ background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                          >
                            Avbryt
                          </button>
                        </>
                      ) : (
                        <>
                          {!level && !isGuest && (
                            <button
                              type="button"
                              onClick={() => recordSoundFor(p)}
                              disabled={recordingFor === p}
                              aria-label={hasSound[p] ? `Ta opp nytt lydklipp for ${p}` : `Ta opp lydklipp for ${p}`}
                              className={`tactile w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${FOCUS_RING}`}
                              style={{
                                background: recordingFor === p ? "var(--color-red)" : "var(--color-cell)",
                                color:
                                  recordingFor === p
                                    ? "var(--color-cream)"
                                    : hasSound[p]
                                      ? "var(--color-teal)"
                                      : "var(--color-muted)",
                                border: "1px solid var(--color-border)",
                              }}
                            >
                              <MicIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmingRemove(p)}
                            className={`tactile px-3 py-1.5 rounded-lg text-sm ${FOCUS_RING}`}
                            style={{ background: "var(--color-cell)", color: "var(--color-red)", border: "1px solid var(--color-border)" }}
                          >
                            Fjern
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {blockedBots && (
                <p className="text-sm text-center" style={{ color: "var(--color-red)" }}>
                  Boter spiller bare ved 1–3 treff per seksjon. Fjern dem, eller velg færre treff.
                </p>
              )}
              </div>
            </div>

            <PrimaryActionButton onClick={startIndividualGame} ready={players.length >= 1 && !blockedBots}>
              Start kampen
            </PrimaryActionButton>
          </>
        )}

        {mode === "team" && (
          <>
            <SavedTeams onPick={pickTeamCard} />

            <PeoplePicker people={teamPeople} onChange={handleTeamPeopleChange} botsAllowed={botsAllowed} />

            {teamPeople.length > 0 && <TeamComposer people={teamPeople} teams={teams} onChange={setTeams} />}

            <PrimaryActionButton
              onClick={startTeamGame}
              ready={teamsReady}
              hint={
                blockedTeamBots
                  ? "Fjern botene, eller velg færre treff per seksjon"
                  : "Trenger minst 2 lag, alle med minst ett medlem, og ingen utildelte spillere"
              }
            >
              Start kampen
            </PrimaryActionButton>
          </>
        )}

      </div>
    </div>
  );
}
