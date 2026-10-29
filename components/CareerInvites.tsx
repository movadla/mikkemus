"use client";

import type { Career } from "@/lib/career";
import { isOpen, lifeOf } from "@/lib/careerLife";
import { answerMessage, markRead, whyNotAnswer } from "@/lib/careerWorld";
import { InviteFacts } from "./CareerInbox";
import { newSeed } from "./careerFormat";
import { TrophyIcon } from "./icons";
import { Button } from "./ui/Button";

/** The invitations that wait, at the top of the tournaments: what it is, what it pays, and a yes or a no. A yes signs the player up and goes on to the opening. */
export function CareerInvites({ career, commit, onPlay }: { career: Career; commit: (c: Career) => void; onPlay: () => void }) {
  const life = lifeOf(career);
  const open = life.inbox.filter((m) => m.offer.kind === "invite" && isOpen(m));
  if (open.length === 0) return null;
  return (
    <ul className="msgs" aria-label="Invitasjoner">
      {open.map((m) => {
        if (m.offer.kind !== "invite") return null;
        const offer = m.offer;
        const left = m.until !== undefined ? m.until - life.week + 1 : null;
        const why = whyNotAnswer(career, m);
        const answer = (accept: boolean) => {
          const next = answerMessage(markRead(career, m.id), m.id, accept, newSeed());
          if (next === career) return;
          commit(next);
          if (accept) onPlay();
        };
        return (
          <li key={m.id} className="msg msg-invite">
            <div className="msg-head">
              <span className="msg-kind" data-tone="gold" aria-hidden>
                <TrophyIcon className="w-5 h-5" />
              </span>
              <span className="min-w-0 text-left">
                <small className="msg-ribbon">INVITASJON</small>
                <b className="block truncate">{m.title}</b>
                <small className="block truncate">
                  {m.from.name}
                  {left !== null && <span className="msg-time"> · {left <= 1 ? "siste uke" : `${left} uker igjen`}</span>}
                </small>
              </span>
            </div>
            <div className="msg-body">
              <p>{m.body}</p>
              <InviteFacts offer={offer} />
              <div className="msg-actions">
                <Button variant="primary" disabled={!!why} onClick={() => answer(true)}>
                  Ta imot
                </Button>
                <Button onClick={() => answer(false)}>Takk nei</Button>
              </div>
              {why && <p className="msg-why">{why}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
