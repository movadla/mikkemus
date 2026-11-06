"use client";

import { useState } from "react";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Sheet } from "./ui/Sheet";

export type OrderSide = { name: string; /** The people in a team. */ members?: string[]; photo?: string | null; isBot?: boolean };

/**
 * Who starts: asked when a match begins, before the board. A pick of the first side, and with more than two sides a new question for each place after it («Hvem
 * er neste?») until the last is left. «Hopp over» keeps the order as it was. `onDone` gets the order chosen, or null.
 */
export function StartOrderSheet({ sides, onDone }: { sides: OrderSide[]; onDone: (order: string[] | null) => void }) {
  const [order, setOrder] = useState<string[]>([]);
  const left = sides.filter((s) => !order.includes(s.name));
  const place = order.length;

  function pick(name: string) {
    const next = [...order, name];
    const rest = sides.filter((s) => !next.includes(s.name));
    // The last one left needs no question.
    if (rest.length <= 1) onDone([...next, ...rest.map((s) => s.name)]);
    else setOrder(next);
  }

  return (
    <Sheet title={place === 0 ? "Hvem starter?" : "Hvem er neste?"} onClose={() => onDone(null)}>
      <div className="grid gap-2" role="group" aria-label={place === 0 ? "Hvem starter?" : "Hvem er neste?"}>
        {order.length > 0 && (
          <p style={{ color: "var(--color-muted)", fontSize: "var(--text-small)" }}>
            {order.map((n, i) => `${i + 1}. ${n}`).join(" · ")}
          </p>
        )}
        {left.map((s) => (
          <Button key={s.name} variant={place === 0 ? "primary" : "secondary"} size="lg" block onClick={() => pick(s.name)}>
            <span className="flex items-center gap-3 min-w-0">
              <Avatar name={s.name} photo={s.photo} px={36} bot={s.isBot} />
              <span className="flex flex-col items-start text-left min-w-0">
                <span className="truncate max-w-full">{s.name}</span>
                {s.members && s.members.length > 0 && s.members.join(" og ") !== s.name && (
                  <small className="truncate max-w-full" style={{ fontWeight: 400, opacity: 0.8 }}>{s.members.join(" og ")}</small>
                )}
              </span>
            </span>
          </Button>
        ))}
        <Button variant="ghost" block onClick={() => onDone(null)}>
          Hopp over
        </Button>
      </div>
    </Sheet>
  );
}
