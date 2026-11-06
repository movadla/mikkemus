"use client";

import { useRef, useState } from "react";
import { setPlayerPhoto, type PlayerRecord } from "@/lib/storage";
import { reportError } from "@/lib/errorReporting";
import { PhotoCropper } from "./PhotoCropper";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";

/**
 * The picture of a player or a team, large, from the list of Spillere: a tap on the small picture of a row opens it. Under it «Bytt bilde» (or «Velg bilde»
 * when there is none) opens the phone's own sheet, camera or library, and the picture is cropped as everywhere else (PhotoCropper) before it is kept.
 */
export function PlayerPictureSheet({ player, onClose }: { player: PlayerRecord; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const photo = player.photo;
  return (
    <>
      <Sheet title={player.name} onClose={onClose}>
        <div className="flex flex-col items-center gap-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the player's own picture, kept as a data URL
            <img src={photo} alt={`Bilde av ${player.name}`} draggable={false} className="w-full" style={{ maxWidth: 360, aspectRatio: "1", objectFit: "cover", borderRadius: "var(--radius-l)", border: "1px solid var(--color-border)" }} />
          ) : (
            <Avatar name={player.name} px={200} />
          )}
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setCropping(file);
          }} />
          <div className="w-full grid gap-2">
            <Button variant="primary" block onClick={() => input.current?.click()}>
              {photo ? "Bytt bilde" : "Velg bilde"}
            </Button>
            <Button variant="secondary" block onClick={onClose}>
              Lukk
            </Button>
          </div>
        </div>
      </Sheet>
      {cropping && (
        <PhotoCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(dataUrl) => {
            setCropping(null);
            try {
              setPlayerPhoto(player.name, dataUrl);
            } catch {
              reportError("Kunne ikke lagre bildet.", { key: "photo-read" });
            }
          }}
        />
      )}
    </>
  );
}
