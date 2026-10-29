"use client";

import { useState } from "react";
import { GAMES, dollars, type Career } from "@/lib/career";
import { lifeOf, isOpen, weekInSeason, type Message } from "@/lib/careerLife";
import { answerMessage, markRead, whyNotAnswer } from "@/lib/careerWorld";
import { newSeed } from "./careerFormat";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { FOCUS_RING } from "./ui/focus";

const STATE: Record<Exclude<Message["state"], "open">, string> = { taken: "Tatt imot", declined: "Avslått", expired: "Gikk ut" };

/** The buttons of an offer: the words say what a yes is. */
const WORDS = {
  invite: ["Ta imot", "Takk nei"],
  challenge: ["Ta den", "Ikke i kveld"],
  sponsor: ["Skriv under", "Ikke nå"],
} as const;

/** What an invitation is, in chips: the number of players, the game, the price and the prize. */
function InviteFacts({ offer }: { offer: Extract<Message["offer"], { kind: "invite" }> }) {
  const i = offer.invite;
  const game = i.countdown ? `${i.countdown.start}${i.countdown.doubleOut ? " dobbel ut" : ""}` : "Din vanlige";
  return (
    <ul className="msg-chips" aria-label="Om turneringen">
      <li>{i.size} spillere</li>
      <li>{game}</li>
      <li>{i.fee === 0 ? "Gratis" : `Innsats ${dollars(i.fee)}`}</li>
      <li>Vinner {dollars(i.prizes.winner ?? 0)}</li>
    </ul>
  );
}

/** The inbox: the people who write, the offers they make and how long they last. Answering is two buttons, and a yes takes the player on to what it was for. */
export function CareerInbox({ career, commit, onPlay, onChallenge }: { career: Career; commit: (c: Career) => void; onPlay: () => void; onChallenge: () => void }) {
  const life = lifeOf(career);
  const [open, setOpen] = useState<string | null>(null);
  if (life.inbox.length === 0) return <p style={{ color: "var(--color-muted)" }}>Ingen meldinger.</p>;
  const toggle = (m: Message) => {
    const next = open === m.id ? null : m.id;
    setOpen(next);
    if (next) commit(markRead(career, m.id));
  };
  const answer = (m: Message, accept: boolean) => {
    const next = answerMessage(career, m.id, accept, newSeed());
    if (next === career) return;
    commit(next);
    if (accept && m.offer.kind === "invite") onPlay();
    else if (accept && m.offer.kind === "challenge") onChallenge();
  };
  return (
    <ul className="msgs" aria-label="Meldinger">
      {life.inbox.map((m) => {
        const person = m.from.role === "Rival" || m.from.role === "Stamgjest";
        const left = m.until !== undefined ? m.until - life.week + 1 : null;
        const why = whyNotAnswer(career, m);
        const offer = m.offer;
        const words = offer.kind === "invite" || offer.kind === "challenge" || offer.kind === "sponsor" ? WORDS[offer.kind] : null;
        return (
          <li key={m.id} className={`msg ${!m.read ? "msg-unread" : ""} ${m.state !== "open" ? "msg-done" : ""}`}>
            <button type="button" className={`msg-head tactile ${FOCUS_RING}`} aria-expanded={open === m.id} onClick={() => toggle(m)}>
              <Avatar name={m.from.name} bot={person} px={40} />
              <span className="min-w-0 text-left">
                <b className="block truncate">{m.title}</b>
                <small className="block truncate">
                  {m.from.name} · uke {weekInSeason(m.week)}
                  {isOpen(m) && left !== null && <span className="msg-time"> · {left <= 1 ? "siste uke" : `${left} uker igjen`}</span>}
                  {m.state !== "open" && <span> · {STATE[m.state]}</span>}
                </small>
              </span>
              {!m.read && <i className="msg-dot" aria-label="Ulest" />}
            </button>
            {open === m.id && (
              <div className="msg-body">
                <p>{m.body}</p>
                {offer.kind === "invite" && <InviteFacts offer={offer} />}
                {offer.kind === "challenge" && (
                  <ul className="msg-chips" aria-label="Om utfordringen">
                    <li>{GAMES[offer.game].name}</li>
                    <li>Vinner {dollars(offer.stake)}</li>
                    {offer.risk > 0 && <li>Taper {dollars(offer.risk)}</li>}
                  </ul>
                )}
                {offer.kind === "sponsor" && (
                  <ul className="msg-chips" aria-label="Om avtalen">
                    <li>{dollars(offer.deal.perEvent)} per turnering</li>
                    <li>{offer.deal.events} turneringer</li>
                  </ul>
                )}
                {m.state === "open" && words && (
                  <>
                    <div className="msg-actions">
                      <Button variant="primary" disabled={!!why} onClick={() => answer(m, true)}>
                        {words[0]}
                      </Button>
                      <Button onClick={() => answer(m, false)}>{words[1]}</Button>
                    </div>
                    {why && <p className="msg-why">{why}</p>}
                    {offer.kind === "challenge" && !why && <p className="msg-why">Å si nei, eller la tiden gå ut, koster litt rykte.</p>}
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
      <li className="msg-foot">Rykte {life.reputation} av 10</li>
    </ul>
  );
}
