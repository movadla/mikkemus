"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ensurePlayer, getPlayerRecord, setPlayerPhoto, setPlayerSound, useRosterNames } from "@/lib/storage";
import { reportError } from "@/lib/errorReporting";
import { BOT_LEVELS, BOT_LEVEL_ORDER, type BotLevel, type TeamMember } from "@/lib/botLevels";
import { avatarAccent } from "@/lib/avatarAccent";
import { CameraIcon, GuestIcon, MicIcon, PeopleIcon, PersonIcon } from "./icons";
import { DartboardGlyph } from "./DartboardGlyph";
import { PeoplePicker, type Person } from "./PeoplePicker";
import { PrimaryActionButton } from "./PrimaryActionButton";
import { TeamComposer, isTeamSetupReady, type Team } from "./TeamComposer";

const RECORDING_MS = 2000;

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

export function SetupScreen({
  onStart,
  onHome,
}: {
  onStart: (
    players: string[],
    botLevels: Record<string, BotLevel>,
    teamRosters?: Record<string, TeamMember[]>,
    guestPlayers?: Record<string, true>
  ) => void;
  onHome?: () => void;
}) {
  const [mode, setMode] = useState<"individual" | "team">("individual");

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

  const teamsReady = isTeamSetupReady(teamPeople, teams);

  function startTeamGame() {
    if (!teamsReady) return;
    const teamRosters: Record<string, TeamMember[]> = {};
    teams.forEach((t) => {
      teamRosters[t.name] = t.members.map((name) => {
        const person = teamPeople.find((p) => p.name === name)!;
        return { name: person.name, isBot: person.isBot, botLevel: person.botLevel };
      });
    });
    onStart(
      teams.map((t) => t.name),
      {},
      teamRosters
    );
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
    const base = `🤖 ${BOT_LEVELS[level].name} (${level})`;
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

  function openCameraFor(name: string) {
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

  return (
    <div
      className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: "var(--color-bg)" }}
    >
      {onHome && (
        <button
          type="button"
          onClick={onHome}
          className={`fixed top-2 left-2 z-40 tactile px-3 py-2 rounded-lg text-sm ${FOCUS_RING}`}
          style={{ background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
        >
          ← Hjem
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoSelected}
      />
      <div className="w-full max-w-md">
        <DartboardGlyph className="w-14 h-14 mx-auto mb-2 block" />
        <h1
          className="text-center mb-6 font-display"
          style={{ color: "var(--color-cream)", fontSize: "2.5rem", letterSpacing: "0.02em" }}
        >
          Mikke Mus <span aria-hidden>🐭</span>
        </h1>

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

        {mode === "individual" && (
          <>
            {availableRoster.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {availableRoster.map((n) => {
                  const photo = getPlayerRecord(n)?.photo;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => addPlayer(n, false)}
                      className={`tactile flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full ${FOCUS_RING}`}
                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    >
                      <span
                        className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                        style={{ background: "var(--color-cell)", border: "1.5px solid rgba(201, 162, 75, 0.5)" }}
                      >
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span style={{ color: avatarAccent(n), fontSize: "0.7rem" }}>
                            {n.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>{n}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-8">
              {addingPlayer ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addPlayer(nameInput, addingAsGuest)}
                    placeholder={addingAsGuest ? "Gjestens navn" : "Spillernavn"}
                    className={`flex-1 px-4 py-3 rounded-lg ${FOCUS_RING}`}
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
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingAsGuest(false);
                      setAddingPlayer(true);
                    }}
                    className={`tactile px-4 py-1.5 rounded-lg text-sm ${FOCUS_RING}`}
                    style={{
                      background: "var(--color-surface)",
                      color: "var(--color-teal)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    Legg til spiller
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingAsGuest(true);
                      setAddingPlayer(true);
                    }}
                    className={`tactile px-4 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${FOCUS_RING}`}
                    style={{
                      background: "var(--color-surface)",
                      color: "var(--color-muted)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <GuestIcon className="w-3.5 h-3.5" />
                    Legg til gjest
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBotPicker((v) => !v)}
                    className={`tactile px-4 py-1.5 rounded-lg text-sm ${FOCUS_RING}`}
                    style={{
                      background: "var(--color-surface)",
                      color: "var(--color-gold)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    🤖 Legg til bot
                  </button>
                </div>
              )}
              {showBotPicker && (
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {BOT_LEVEL_ORDER.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => addBot(level)}
                      className={`tactile px-3 py-1.5 rounded-full text-sm ${FOCUS_RING}`}
                      style={{ background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}
                    >
                      {BOT_LEVELS[level].name} ({level})
                    </button>
                  ))}
                </div>
              )}
              {error && (
                <p className="text-sm mt-2 text-center" style={{ color: "var(--color-red)" }}>
                  {error}
                </p>
              )}
            </div>

            <div className="shadow-panel rounded-xl p-4 mb-8" style={{ background: "var(--color-panel)", border: "1px solid var(--color-border)" }}>
              <p className="text-center mb-3" style={{ color: "var(--color-gold)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                SPILLERE
              </p>
              <div className="space-y-2 min-h-[64px]">
              {players.length === 0 && (
                <p className="text-center py-2" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
                  Ingen spillere lagt til enda
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
                          style={{ background: "var(--color-cell)", border: "1.5px solid rgba(201, 162, 75, 0.5)" }}
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
                          onClick={() => openCameraFor(p)}
                          className={`tactile w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${FOCUS_RING}`}
                          style={{
                            background: "var(--color-cell)",
                            border: "1.5px solid rgba(201, 162, 75, 0.5)",
                            color: "var(--color-muted)",
                          }}
                          aria-label={`Ta bilde av ${p}`}
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
                            style={{ color: "var(--color-red)" }}
                            className={`text-sm px-2 font-medium ${FOCUS_RING}`}
                          >
                            Sikker?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRemove(null)}
                            style={{ color: "var(--color-teal)" }}
                            className={`text-sm px-2 ${FOCUS_RING}`}
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
                            style={{ color: "var(--color-red)" }}
                            className={`text-sm px-2 ${FOCUS_RING}`}
                          >
                            Fjern
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            <PrimaryActionButton
              onClick={() => onStart(players, botLevels, undefined, guestPlayers)}
              ready={players.length >= 1}
              hint="Velg minst en spiller over for å starte"
            >
              Start spill
            </PrimaryActionButton>
          </>
        )}

        {mode === "team" && (
          <>
            <PeoplePicker people={teamPeople} onChange={handleTeamPeopleChange} />

            {teamPeople.length > 0 && <TeamComposer people={teamPeople} teams={teams} onChange={setTeams} />}

            <PrimaryActionButton
              onClick={startTeamGame}
              ready={teamsReady}
              hint="Trenger minst 2 lag, alle med minst ett medlem, og ingen utildelte spillere"
            >
              Start spill
            </PrimaryActionButton>
          </>
        )}

        <p className="text-center mt-8 flex justify-center gap-4">
          <Link
            href="/spillere"
            className={`font-display text-sm underline ${FOCUS_RING}`}
            style={{ color: "var(--color-muted)", fontStyle: "italic" }}
          >
            Se spillerstatistikk
          </Link>
          <Link
            href="/hall-of-fame"
            className={`font-display text-sm underline ${FOCUS_RING}`}
            style={{ color: "var(--color-muted)", fontStyle: "italic" }}
          >
            Hall of Fame
          </Link>
        </p>
      </div>
    </div>
  );
}
