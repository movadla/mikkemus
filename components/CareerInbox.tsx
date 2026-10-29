"use client";

import { Fragment, useState } from "react";
import { GAMES, dollars, type Career } from "@/lib/career";
import { dealsOf, sponsorLogo, lifeOf, isOpen, type Message } from "@/lib/careerLife";
import { answerMessage, markRead, whyNotAnswer } from "@/lib/careerWorld";
import { newSeed } from "./careerFormat";
import { Avatar } from "./ui/Avatar";
import { MailIcon } from "./careerIcons";
import { BoltIcon, CoinIcon, TrophyIcon, TvIcon } from "./icons";
import { Button } from "./ui/Button";
import { FOCUS_RING } from "./ui/focus";

/** What a message is, in one word and one symbol, so the list can be read at a glance: an invitation, a challenge someone asks for, a show, a sponsor, or a note. */
function kindOf(m: Message): {
  word: string;
  icon: React.ReactNode;
  tone: string;
} {
  const o = m.offer;
  if (o.kind === "invite")
    return {
      word: "Invitasjon",
      icon: <TrophyIcon className="w-5 h-5" />,
      tone: "gold",
    };
  if (o.kind === "challenge")
    return o.tv
      ? { word: "TV", icon: <TvIcon className="w-5 h-5" />, tone: "teal" }
      : {
          word: "Utfordring",
          icon: <BoltIcon className="w-5 h-5" />,
          tone: "red",
        };
  if (o.kind === "sponsor")
    return {
      word: "Sponsor",
      icon: <CoinIcon className="w-5 h-5" />,
      tone: "gold",
    };
  return {
    word: "Beskjed",
    icon: <MailIcon className="w-5 h-5" />,
    tone: "muted",
  };
}

const STATE: Record<Exclude<Message["state"], "open">, string> = {
  taken: "Tatt imot",
  declined: "Avslått",
  expired: "Gikk ut",
};

/** The buttons of an offer: the words say what a yes is. */
const WORDS = {
  challenge: ["Ta den", "Ikke i kveld"],
} as const;

/** What an invitation is, in chips: the number of players, the game, the price and the prize. */
export function InviteFacts({ offer }: { offer: Extract<Message["offer"], { kind: "invite" }> }) {
  const i = offer.invite;
  return (
    <ul className="msg-chips" aria-label="Om turneringen">
      {i.countdown && <li>{i.countdown.humanStart ? `Du starter på ${i.countdown.humanStart}` : i.countdown.start}</li>}
      <li>{i.fee === 0 ? "Gratis" : dollars(i.fee)}</li>
      {!!i.honorarium && <li>Honorar {dollars(i.honorarium)}</li>}
      <li>Vinner {dollars(i.prizes.winner ?? 0)}</li>
    </ul>
  );
}

/** The inbox: the people who write, the offers they make and how long they last. Answering is two buttons, and a yes takes the player on to what it was for. */
export function CareerInbox({
  career,
  commit,
  onChallenge,
  onRoad,
}: {
  career: Career;
  commit: (c: Career) => void;
  onChallenge: () => void;
  /** An invitation is answered under the tournaments: this takes the player there. */ onRoad: () => void;
}) {
  const life = lifeOf(career);
  const [open, setOpen] = useState<string | null>(null);
  if (life.inbox.length === 0) return <p style={{ color: "var(--color-muted)" }}>Ingen meldinger.</p>;
  const toggle = (m: Message) => {
    const next = open === m.id ? null : m.id;
    setOpen(next);
    if (next) commit(markRead(career, m.id));
  };
  const answer = (m: Message, accept: boolean, pick = 0) => {
    const next = answerMessage(career, m.id, accept, newSeed(), pick);
    if (next === career) return;
    commit(next);
    if (accept && m.offer.kind === "challenge") onChallenge();
  };
  return (
    <ul className="msgs" aria-label="Meldinger">
      {[...life.inbox.filter((m) => isOpen(m)), ...life.inbox.filter((m) => !isOpen(m))].map((m, idx, all) => {
        // What waits for an answer stands first, under its own heading; what is answered or gone follows under another.
        const head = idx === 0 ? (isOpen(m) ? "VENTER PÅ SVAR" : "TIDLIGERE") : isOpen(all[idx - 1]) && !isOpen(m) ? "TIDLIGERE" : null;
        const person = m.from.role === "Rival" || m.from.role === "Stamgjest";
        const left = m.until !== undefined ? m.until - life.week + 1 : null;
        const why = whyNotAnswer(career, m);
        const offer = m.offer;
        const words = offer.kind === "challenge" ? WORDS.challenge : null;
        return (
          <Fragment key={m.id}>
            {head && <li className="msgs-head section-label">{head}</li>}
            <li className={`msg ${!m.read ? "msg-unread" : ""} ${m.state !== "open" ? "msg-done" : ""}`}>
              <button type="button" className={`msg-head tactile ${FOCUS_RING}`} aria-expanded={open === m.id} onClick={() => toggle(m)}>
                {person ? (
                  <Avatar name={m.from.name} bot px={40} />
                ) : (
                  <span className="msg-kind" data-tone={kindOf(m).tone} aria-hidden>
                    {kindOf(m).icon}
                  </span>
                )}
                <span className="min-w-0 text-left">
                  <b className="block truncate">{m.title}</b>
                  <small className="block truncate">
                    {kindOf(m).word} · {m.from.name}
                    {isOpen(m) && left !== null && <span className="msg-time"> · {left <= 1 ? "siste uke" : `${left} uker igjen`}</span>}
                    {m.state !== "open" && <span> · {STATE[m.state]}</span>}
                  </small>
                </span>
                {!m.read && <i className="msg-dot" aria-label="Ulest" />}
              </button>
              {open === m.id && (
                <div className="msg-body">
                  {offer.kind !== "sponsor" && <p>{m.body}</p>}
                  {offer.kind === "invite" && <InviteFacts offer={offer} />}
                  {offer.kind === "challenge" && (
                    <ul className="msg-chips" aria-label="Om utfordringen">
                      {offer.tv ? (
                        <>
                          {offer.tv.humanStart !== offer.tv.theirStart ? <li>Du starter på {offer.tv.humanStart}</li> : <li>Best av {offer.tv.legs}</li>}
                          <li>Honorar {dollars(offer.tv.honorarium)}</li>
                        </>
                      ) : (
                        <li>{GAMES[offer.game].name}</li>
                      )}
                      <li>Vinner {dollars(offer.stake)}</li>
                      {offer.risk > 0 && <li>Taper {dollars(offer.risk)}</li>}
                    </ul>
                  )}
                  {offer.kind === "sponsor" && (
                    <ul className="msg-deals" aria-label="Avtalene">
                      {dealsOf(offer).map((d, i) => (
                        <li key={d.name}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sponsorLogo(d.name)} alt="" className="sponsor-logo" width={44} height={44} draggable={false} />
                          <span className="min-w-0 flex-1">
                            <b className="block truncate">{d.name}</b>
                            <small className="block">
                              {dollars(d.perEvent)} · {d.events} turneringer
                            </small>
                          </span>
                          {m.state === "open" && (
                            <Button variant="primary" disabled={!!why} onClick={() => answer(m, true, i)}>
                              Velg
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.state === "open" && offer.kind === "sponsor" && (
                    <>
                      <div className="msg-actions">
                        <Button onClick={() => answer(m, false)}>Ikke nå</Button>
                      </div>
                      {why && <p className="msg-why">{why}</p>}
                    </>
                  )}
                  {m.state === "open" && offer.kind === "invite" && (
                    <div className="msg-actions">
                      <Button variant="primary" onClick={onRoad}>
                        Svar under Turneringer
                      </Button>
                    </div>
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
                      {offer.kind === "challenge" && !offer.tv && !why && <p className="msg-why">Nei koster litt rykte.</p>}
                    </>
                  )}
                </div>
              )}
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
