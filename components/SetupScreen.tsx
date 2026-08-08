"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ensurePlayer, getPlayerRecord, setPlayerPhoto, setPlayerSound, useRosterNames } from "@/lib/storage";
import { BOT_LEVELS, BOT_LEVEL_ORDER, type BotLevel } from "@/lib/botLevels";
import { CameraIcon, MicIcon } from "./icons";
import { DartboardGlyph } from "./DartboardGlyph";

const RECORDING_MS = 2000;

export function SetupScreen({ onStart }: { onStart: (players: string[], botLevels: Record<string, BotLevel>) => void }) {
  const [nameInput, setNameInput] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [botLevels, setBotLevels] = useState<Record<string, BotLevel>>({});
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const rosterNames = useRosterNames();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [hasSound, setHasSound] = useState<Record<string, boolean>>({});
  const [capturingFor, setCapturingFor] = useState<string | null>(null);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const FOCUS_RING =
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";

  function addPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (players.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" er allerede lagt til`);
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
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setPlayerSound(name, dataUrl);
          setHasSound((prev) => ({ ...prev, [name]: true }));
        };
        reader.readAsDataURL(blob);
        setRecordingFor(null);
      };
      setRecordingFor(name);
      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, RECORDING_MS);
    } catch {
      setRecordingFor(null);
    }
  }

  return (
    <div
      className="animate-screen-enter min-h-screen w-full flex items-center justify-center p-6"
      style={{ background: "var(--color-bg)" }}
    >
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

        {availableRoster.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {availableRoster.map((n) => {
              const photo = getPlayerRecord(n)?.photo;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => addPlayer(n)}
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
                      <span style={{ color: "var(--color-muted)", fontSize: "0.7rem" }}>
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
                onKeyDown={(e) => e.key === "Enter" && addPlayer(nameInput)}
                placeholder="Spillernavn"
                className={`flex-1 px-4 py-3 rounded-lg ${FOCUS_RING}`}
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-cream)",
                  border: "1px solid var(--color-border)",
                }}
              />
              <button
                type="button"
                onClick={() => addPlayer(nameInput)}
                className={`tactile px-5 py-3 rounded-lg font-medium ${FOCUS_RING}`}
                style={{ background: "var(--color-teal)", color: "var(--color-bg)" }}
              >
                Legg til
              </button>
            </div>
          ) : (
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setAddingPlayer(true)}
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
          {players.map((p, i) => {
            const level = botLevels[p];
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
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!level && (
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
                    onClick={() => removePlayer(p)}
                    style={{ color: "var(--color-red)" }}
                    className={`text-sm px-2 ${FOCUS_RING}`}
                  >
                    Fjern
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => (players.length < 1 ? setStartError(true) : onStart(players, botLevels))}
          className={`tactile w-full py-4 rounded-lg font-semibold text-lg ${FOCUS_RING}`}
          style={{ background: "var(--color-green)", color: "var(--color-cream)" }}
        >
          Start spill
        </button>
        {startError && players.length < 1 && (
          <p className="text-center mt-3" style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>
            Velg minst en spiller over for å starte
          </p>
        )}

        <p className="text-center mt-8">
          <Link
            href="/spillere"
            className={`font-display text-sm underline ${FOCUS_RING}`}
            style={{ color: "var(--color-muted)", fontStyle: "italic" }}
          >
            Se spillerstatistikk
          </Link>
        </p>
      </div>
    </div>
  );
}
