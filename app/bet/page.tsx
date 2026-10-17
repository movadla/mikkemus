"use client";

import { useEffect, useMemo, useState } from "react";
import { ScreenTop } from "@/components/ScreenTop";
import { useLiveMatch } from "@/lib/liveMatch";
import { addUser, marketOpen, newNight, offerBet, removeUser, settleMatch, takeBet, withdrawBet } from "@/lib/bet/api";
import { atStake, balances, fairPrice, liabilityFor, lifetimeNet, netByUser, settleUp, stakeProblem, START_COINS, type BetRow, type BetUser } from "@/lib/bet/ledger";
import { useBet } from "@/lib/bet/useBet";

const FOCUS_RING = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-teal)]";
const ME_KEY = "bet-me";

/** 1 000 → «1 000» with a narrow no-break space, like the rest of the Norwegian UI. */
const coins = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("nb-NO").replace(/\s/g, " ")}`;
const signed = (n: number) => (n > 0 ? `+${coins(n)}` : coins(n));
const oddsText = (o: number) => o.toFixed(2).replace(".", ",");
const tone = (n: number) => (n > 0 ? "var(--color-green)" : n < 0 ? "var(--color-red)" : "var(--color-muted)");

type Tab = "spill" | "stilling" | "regnskap";

export default function BetPage() {
  const live = useLiveMatch();
  const bet = useBet(live);
  const { books, night } = bet;
  const [tab, setTab] = useState<Tab>("spill");
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(ME_KEY);
        if (saved) setMeId(saved);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const chooseMe = (id: string | null) => {
    setMeId(id);
    try {
      if (id) localStorage.setItem(ME_KEY, id);
      else localStorage.removeItem(ME_KEY);
    } catch {}
  };

  const users = books?.users ?? [];
  const me = users.find((u) => u.id === meId) ?? null;
  const bal = useMemo(() => (books ? balances(books.ledger, night) : {}), [books, night]);

  return (
    <div className="animate-screen-enter screen" style={{ background: "var(--color-bg)" }}>
      <div className="screen-inner">
        <ScreenTop title="Spill på morro" backHref="/" />
        <p className="text-center mb-4" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
          Virtuelle mynter, ingen ekte penger.
        </p>

        {bet.setupNeeded ? (
          <SetupNeeded />
        ) : !books ? (
          <p className="text-center py-8" style={{ color: "var(--color-muted)" }}>
            {bet.error ? bet.error : "Henter regnskapet …"}
          </p>
        ) : (
          <>
            <PeopleBar users={users} bal={bal} meId={meId} onPick={chooseMe} night={night} onChanged={bet.refresh} onAdded={(u) => chooseMe(u.id)} />
            <div className="grid grid-cols-3 gap-2 my-4" role="tablist">
              {(["spill", "stilling", "regnskap"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`tactile rounded-lg ${FOCUS_RING}`}
                  style={{
                    minHeight: "2.75rem",
                    background: tab === t ? "var(--color-teal)" : "var(--color-surface)",
                    color: tab === t ? "var(--color-bg)" : "var(--color-cream)",
                    border: "1px solid var(--color-border)",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  {t === "spill" ? "Spill" : t === "stilling" ? "Stilling" : "Regnskap"}
                </button>
              ))}
            </div>
            {tab === "spill" && <PlayTab bet={bet} live={live} me={me} balance={me ? bal[me.id] ?? 0 : 0} />}
            {tab === "stilling" && <TableTab bet={bet} />}
            {tab === "regnskap" && <AccountsTab bet={bet} />}
            <HowItWorks />
          </>
        )}
      </div>
    </div>
  );
}

function Card({ children, title, hint }: { children: React.ReactNode; title?: string; hint?: string }) {
  return (
    <section className="shadow-panel rounded-xl p-4 mb-4" style={{ background: "var(--color-surface)" }}>
      {title && (
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="section-label">{title}</h2>
          {hint && <span style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

function SetupNeeded() {
  return (
    <Card title="Må settes opp først">
      <p style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>Spillsiden trenger fire tabeller i Supabase. Det gjøres én gang:</p>
      <ol className="mt-3 space-y-2 list-decimal pl-5" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
        <li>Åpne Supabase og gå til SQL Editor.</li>
        <li>Lim inn innholdet i filen supabase-setup-bet.sql fra prosjektet.</li>
        <li>Trykk Run, og last denne siden på nytt.</li>
      </ol>
      <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>Resten av appen virker som før uten denne.</p>
    </Card>
  );
}

function PeopleBar({ users, bal, meId, onPick, night, onChanged, onAdded }: { users: BetUser[]; bal: Record<string, number>; meId: string | null; onPick: (id: string | null) => void; night: number; onChanged: () => Promise<void>; onAdded: (u: BetUser) => void }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(users.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    const r = await addUser(name, night);
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    setName("");
    setError(null);
    setAdding(false);
    onAdded(r.user);
    await onChanged();
  };

  return (
    <Card title="Hvem er du?" hint={users.length ? `${users.length} med` : undefined}>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onPick(meId === u.id ? null : u.id)}
            aria-pressed={meId === u.id}
            className={`tactile rounded-full px-4 ${FOCUS_RING}`}
            style={{
              minHeight: "2.75rem",
              background: meId === u.id ? "var(--color-gold)" : "var(--color-cell)",
              color: meId === u.id ? "var(--color-bg)" : "var(--color-cream)",
              border: "1px solid var(--color-border)",
              fontWeight: 600,
            }}
          >
            {u.name} <span className="tabular" style={{ opacity: 0.8, fontWeight: 500 }}>{coins(bal[u.id] ?? 0)}</span>
          </button>
        ))}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={`tactile rounded-full px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "transparent", color: "var(--color-teal-strong)", border: "1px dashed var(--color-teal)" }}>
            + Legg til
          </button>
        )}
      </div>
      {adding && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn"
            maxLength={24}
            aria-label="Navn på ny deltaker"
            className={`flex-1 min-w-0 rounded-lg px-3 ${FOCUS_RING}`}
            style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "1rem" }}
          />
          <button type="submit" disabled={busy || !name.trim()} className={`glossy rounded-lg px-4 ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "2.75rem", fontWeight: 700, opacity: busy || !name.trim() ? 0.5 : 1 } as React.CSSProperties}>
            Start med {coins(START_COINS)}
          </button>
        </form>
      )}
      {error && <p className="mt-2" style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
      {users.length > 0 && !meId && <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>Trykk på navnet ditt for å spille.</p>}
    </Card>
  );
}

function PlayTab({ bet, live, me, balance }: { bet: ReturnType<typeof useBet>; live: ReturnType<typeof useLiveMatch>; me: BetUser | null; balance: number }) {
  const books = bet.books!;
  const open = marketOpen(live);
  const inMatch = !!live && live.screen !== "setup" && !!live.matchId && !!live.odds?.length;
  const [pick, setPick] = useState<string | null>(null);
  const [stake, setStake] = useState("100");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (id: string | null) => books.users.find((u) => u.id === id)?.name ?? "?";

  const stakeNum = Number(stake.replace(/\s/g, ""));
  const problem = stakeProblem(stakeNum, balance);
  const sides = (live?.odds ?? []).map((o) => ({ ...o, odds: fairPrice(o.p) }));
  const chosen = sides.find((o) => o.name === pick) ?? null;
  const liability = chosen && problem === "none" ? liabilityFor(stakeNum, chosen.odds) : 0;

  const offer = async () => {
    if (!me || !live?.matchId || !chosen) return;
    setBusy(true);
    const r = await offerBet({ userId: me.id, night: bet.night, matchId: live.matchId, pick: chosen.name, stake: stakeNum, shownOdds: chosen.odds, shownTurn: live.turnToken });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: `Lagt ut: ${coins(stakeNum)} på ${chosen.name} til ${oddsText(chosen.odds)}. Spillet gjelder når noen tar imot.` });
      setPick(null);
      await bet.refresh();
    } else setMsg({ ok: false, text: r.reason });
  };
  const take = async (b: BetRow) => {
    if (!me) return;
    setBusy(true);
    const r = await takeBet({ userId: me.id, night: bet.night, betId: b.id });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Du tok imot ${name(b.backer_id)}. Du risikerer ${coins(b.liability)} for å vinne ${coins(b.stake)}.` } : { ok: false, text: r.reason });
    await bet.refresh();
  };
  const withdraw = async (b: BetRow) => {
    setBusy(true);
    await withdrawBet(b, bet.night);
    setBusy(false);
    await bet.refresh();
  };

  const here = books.bets.filter((b) => b.match_id === live?.matchId);
  const offers = here.filter((b) => b.status === "open" && b.turn === live?.turnToken);
  const running = here.filter((b) => b.status === "matched");
  const mine = books.bets.filter((b) => me && (b.backer_id === me.id || b.layer_id === me.id)).slice(0, 10);
  const stale = books.matches.filter((m) => (m.status === "open" || m.status === "done") && m.match_id !== live?.matchId && books.bets.some((b) => b.match_id === m.match_id && b.status === "matched"));
  const otherSide = (s: string) => sides.find((o) => o.name !== s)?.name ?? "motstanderen";

  return (
    <>
      <Card title="Kampen nå" hint={live?.screen === "winner" && bet.settlingIn ? `Utbetaling om ${bet.settlingIn} s` : open ? "Spill åpent" : inMatch ? "Stengt" : undefined}>
        {!inMatch || !live ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>Ingen kamp i gang. Når en kamp starter dukker oddsen opp her.</p>
        ) : (
          <>
            <p className="mb-2" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>Hvem tror du vinner? Oddsen er prisen på spillet ditt.</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sides.length, 2)}, minmax(0, 1fr))` }}>
              {sides.map((o) => {
                const active = pick === o.name;
                return (
                  <button
                    key={o.name}
                    type="button"
                    disabled={!open || !me}
                    onClick={() => {
                      setPick(active ? null : o.name);
                      setMsg(null);
                    }}
                    aria-pressed={active}
                    className={`tactile rounded-xl px-3 py-3 text-center ${FOCUS_RING}`}
                    style={{
                      background: active ? "var(--color-gold)" : "var(--color-cell)",
                      color: active ? "var(--color-bg)" : "var(--color-cream)",
                      border: "1px solid var(--color-border)",
                      opacity: open && me ? 1 : 0.6,
                      minHeight: "4.5rem",
                    }}
                  >
                    <span className="block truncate" style={{ fontWeight: 600 }}>{o.name}</span>
                    <span className="block tabular font-display" style={{ fontSize: "1.6rem", lineHeight: 1.1 }}>{oddsText(o.odds)}</span>
                    <span className="block" style={{ fontSize: "0.75rem", opacity: 0.8 }}>{Math.round(o.p * 100)} % sjanse</span>
                  </button>
                );
              })}
            </div>
            {!me && <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Velg navnet ditt øverst for å spille.</p>}
            {me && !open && <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>{live.screen === "winner" ? "Kampen er ferdig." : "Spillet åpner igjen mellom rundene, når alle tre pilene er kastet."}</p>}

            {me && open && chosen && (
              <div className="mt-4">
                <p className="mb-2" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
                  {me.name}, hvor mye på <strong>{chosen.name}</strong>? Du har {coins(balance)}.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[50, 100, 250, 500].map((n) => (
                    <button key={n} type="button" disabled={n > balance} onClick={() => setStake(String(n))} className={`tactile rounded-full px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: stakeNum === n ? "var(--color-teal)" : "var(--color-cell)", color: stakeNum === n ? "var(--color-bg)" : "var(--color-cream)", border: "1px solid var(--color-border)", opacity: n > balance ? 0.4 : 1 }}>
                      {coins(n)}
                    </button>
                  ))}
                  <button type="button" onClick={() => setStake(String(balance))} className={`tactile rounded-full px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-gold-strong)", border: "1px solid var(--color-border)" }}>
                    Alt
                  </button>
                </div>
                <div className="flex gap-2 items-stretch">
                  <input
                    inputMode="numeric"
                    value={stake}
                    onChange={(e) => setStake(e.target.value.replace(/[^\d]/g, ""))}
                    aria-label="Innsats i mynter"
                    className={`w-28 rounded-lg px-3 tabular ${FOCUS_RING}`}
                    style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "1.1rem" }}
                  />
                  <button type="button" disabled={busy || problem !== "none" || liability < 1} onClick={() => void offer()} className={`glossy flex-1 rounded-lg ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-gold)", color: "var(--color-bg)", minHeight: "2.75rem", fontWeight: 700, opacity: busy || problem !== "none" || liability < 1 ? 0.5 : 1 } as React.CSSProperties}>
                    {problem === "none" ? "Legg ut spillet" : problem === "too-high" ? "Mer enn du har" : "Skriv en innsats"}
                  </button>
                </div>
                {problem === "none" && liability >= 1 && (
                  <p className="mt-2" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
                    Vinner {chosen.name}, får du {coins(stakeNum + liability)} (gevinst {coins(liability)}). Vinner {otherSide(chosen.name)}, mister du {coins(stakeNum)}. Spillet gjelder først når noen andre tar imot, og trekkes tilbake av seg selv hvis ingen gjør det før neste runde.
                  </p>
                )}
              </div>
            )}
            {msg && (
              <p role="status" className="mt-3" style={{ color: msg.ok ? "var(--color-green)" : "var(--color-red)", fontSize: "0.9rem" }}>
                {msg.text}
              </p>
            )}
          </>
        )}
      </Card>

      {inMatch && (
        <Card title="Venter på motpart" hint={offers.length ? `${offers.length}` : undefined}>
          {offers.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>Ingen åpne spill akkurat nå. Legg ut ett over, så kan en annen ta imot.</p>
          ) : (
            <ul className="space-y-2">
              {offers.map((b) => (
                <li key={b.id} className="rounded-lg px-3 py-3" style={{ background: "var(--color-cell)" }}>
                  <p style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
                    <strong>{name(b.backer_id)}</strong> satser {coins(b.stake)} på <strong>{b.pick}</strong> til {oddsText(b.odds)}
                  </p>
                  {me && b.backer_id === me.id ? (
                    <button type="button" disabled={busy} onClick={() => void withdraw(b)} className={`tactile mt-2 rounded-lg px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
                      Trekk tilbake
                    </button>
                  ) : (
                    <button type="button" disabled={busy || !me || !open} onClick={() => void take(b)} className={`glossy mt-2 w-full rounded-lg ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-teal)", color: "var(--color-bg)", minHeight: "2.75rem", fontWeight: 700, opacity: busy || !me || !open ? 0.5 : 1 } as React.CSSProperties}>
                      {me ? `Ta imot: ${otherSide(b.pick)} vinner. Risiker ${coins(b.liability)}, vinn ${coins(b.stake)}` : "Velg navn først"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {running.length > 0 && (
        <Card title="Spill i gang" hint={`${running.length}`}>
          <ul className="space-y-2">
            {running.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "var(--color-cell)" }}>
                <span style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
                  <strong>{name(b.backer_id)}</strong> på {b.pick} mot <strong>{name(b.layer_id)}</strong>
                </span>
                <span className="tabular shrink-0" style={{ color: "var(--color-gold-strong)", fontWeight: 700 }}>{coins(b.stake + b.liability)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {me && (
        <Card title={`Spillene til ${me.name}`} hint={`${coins(atStake(books.bets, me.id))} på spill`}>
          {mine.length === 0 ? (
            <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>Ingen spill ennå.</p>
          ) : (
            <ul className="space-y-2">
              {mine.map((b) => (
                <BetLine key={b.id} b={b} meId={me.id} name={name} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {stale.length > 0 && <Stale matches={stale} bets={books.bets} night={bet.night} refresh={bet.refresh} name={name} />}
    </>
  );
}

function BetLine({ b, meId, name }: { b: BetRow; meId: string; name: (id: string | null) => string }) {
  const backer = b.backer_id === meId;
  const risked = backer ? b.stake : b.liability;
  const won = b.status === "won" ? backer : b.status === "lost" ? !backer : null;
  const label =
    b.status === "open" ? "Venter på motpart" : b.status === "matched" ? "I gang" : b.status === "cancelled" ? "Trukket tilbake" : b.status === "void" ? "Tilbakebetalt" : won ? `Vant +${coins(backer ? b.liability : b.stake)}` : `Tapte −${coins(risked)}`;
  const color = won === true ? "var(--color-green)" : won === false ? "var(--color-red)" : "var(--color-muted)";
  const against = backer ? b.layer_id : b.backer_id;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "var(--color-cell)" }}>
      <span className="min-w-0">
        <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>
          {backer ? b.pick : `Mot ${b.pick}`}
        </span>
        <span className="block" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
          {coins(risked)} til {oddsText(b.odds)}
          {against ? ` · mot ${name(against)}` : ""} · {b.phase === "pre" ? "før kampen" : "under kampen"}
        </span>
      </span>
      <span className="tabular shrink-0" style={{ color, fontWeight: 700, fontSize: "0.9rem" }}>{label}</span>
    </li>
  );
}

/** Bets whose match ended without /bet being open to see who won: decide them by hand. */
function Stale({ matches, bets, night, refresh, name }: { matches: { match_id: string; sides: string[] }[]; bets: BetRow[]; night: number; refresh: () => Promise<void>; name: (id: string | null) => string }) {
  const [busy, setBusy] = useState(false);
  const decide = async (id: string, winner: string | null) => {
    setBusy(true);
    await settleMatch(id, winner, night);
    setBusy(false);
    await refresh();
  };
  return (
    <Card title="Spill som ikke er avgjort" hint="Kampen er over">
      <p className="mb-3" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>Disse kampene ble ikke avgjort automatisk. Velg hvem som vant, eller betal tilbake innsatsene.</p>
      <div className="space-y-3">
        {matches.map((m) => {
          const list = bets.filter((b) => b.match_id === m.match_id && b.status === "matched");
          const sides = m.sides.length ? m.sides : [...new Set(list.map((b) => b.pick))];
          return (
            <div key={m.match_id} className="rounded-lg p-3" style={{ background: "var(--color-cell)" }}>
              <p className="mb-2" style={{ color: "var(--color-cream)", fontSize: "0.85rem" }}>
                {sides.join(" mot ")} · {list.length} spill ({list.map((b) => `${name(b.backer_id)}–${name(b.layer_id)}`).join(", ")})
              </p>
              <div className="flex flex-wrap gap-2">
                {sides.map((s) => (
                  <button key={s} type="button" disabled={busy} onClick={() => void decide(m.match_id, s)} className={`tactile rounded-full px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-surface)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
                    {s} vant
                  </button>
                ))}
                <button type="button" disabled={busy} onClick={() => void decide(m.match_id, null)} className={`tactile rounded-full px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "transparent", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}>
                  Betal tilbake
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TableTab({ bet }: { bet: ReturnType<typeof useBet> }) {
  const books = bet.books!;
  const [all, setAll] = useState(false);
  const bal = balances(books.ledger, bet.night);
  const life = lifetimeNet(books.ledger);
  const rows = books.users
    .map((u) => ({ u, value: all ? life[u.id] ?? 0 : (bal[u.id] ?? 0) - START_COINS, bal: bal[u.id] ?? 0, stake: atStake(books.bets, u.id) }))
    .sort((a, b) => b.value - a.value);
  return (
    <Card title={all ? "Alle kvelder" : `Kveld ${bet.night}`}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[false, true].map((v) => (
          <button key={String(v)} type="button" onClick={() => setAll(v)} aria-pressed={all === v} className={`tactile rounded-lg ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: all === v ? "var(--color-cell-done)" : "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)", fontSize: "0.85rem" }}>
            {v ? "Alle kvelder" : "I kveld"}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>Ingen deltakere ennå.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.u.id} className="flex items-center gap-3 rounded-lg px-3" style={{ minHeight: "3.25rem", background: i === 0 && r.value > 0 ? "var(--color-cell-done)" : "var(--color-cell)" }}>
              <span className="font-display w-6 text-center" style={{ color: i === 0 ? "var(--color-gold)" : "var(--color-muted)" }}>{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ color: "var(--color-cream)", fontWeight: 600 }}>{r.u.name}</span>
                <span className="block" style={{ color: "var(--color-muted)", fontSize: "0.75rem" }}>
                  {coins(r.bal)} i kveld{r.stake > 0 ? ` · ${coins(r.stake)} på spill` : ""}
                </span>
              </span>
              <span className="tabular" style={{ color: tone(r.value), fontWeight: 700, fontSize: "1.05rem" }}>{signed(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function AccountsTab({ bet }: { bet: ReturnType<typeof useBet> }) {
  const books = bet.books!;
  const [confirm, setConfirm] = useState<"night" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nets = netByUser(books.ledger, bet.night);
  const name = (id: string) => books.users.find((u) => u.id === id)?.name ?? "?";
  const transfers = settleUp(books.users.map((u) => ({ id: u.id, net: nets[u.id] ?? 0 })));
  const pending = books.bets.some((b) => b.status === "open" || b.status === "matched");

  return (
    <>
      <Card title="Hvem skylder hvem" hint={`Kveld ${bet.night}`}>
        {books.users.length < 2 ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>Legg til minst to deltakere for å gjøre opp mellom dere.</p>
        ) : transfers.length === 0 ? (
          <p style={{ color: "var(--color-cream)" }}>Alle står likt. Ingen skylder noe.</p>
        ) : (
          <ul className="space-y-2">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-3" style={{ background: "var(--color-cell)" }}>
                <span style={{ color: "var(--color-cream)" }}>
                  <strong>{name(t.from)}</strong> skylder <strong>{name(t.to)}</strong>
                </span>
                <span className="tabular font-display" style={{ color: "var(--color-gold-strong)", fontSize: "1.3rem" }}>{coins(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {books.users.length >= 2 && (
          <p className="mt-3" style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>
            Hvert spill er mellom to av dere, så regnskapet går opp i null. Det er satt opp med færrest mulig overføringer.
          </p>
        )}
      </Card>

      <Card title="Per person">
        <ul className="space-y-2">
          {books.users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "var(--color-cell)" }}>
              <span style={{ color: "var(--color-cream)" }}>{u.name}</span>
              <span className="flex items-center gap-3">
                <span className="tabular" style={{ color: tone(nets[u.id] ?? 0), fontWeight: 700 }}>{signed(nets[u.id] ?? 0)}</span>
                {confirm === u.id ? (
                  <button type="button" onClick={async () => { const r = await removeUser(u.id); if (!r.ok) setError(r.reason); setConfirm(null); await bet.refresh(); }} className={`rounded-lg px-3 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", color: "var(--color-red)", border: "1px solid var(--color-red)", fontSize: "0.8rem" }}>
                    Slett for godt
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirm(u.id)} aria-label={`Fjern ${u.name}`} className={`rounded-lg px-3 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", color: "var(--color-muted)", fontSize: "0.8rem" }}>
                    Fjern
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2" style={{ color: "var(--color-red)", fontSize: "0.85rem" }}>{error}</p>}
      </Card>

      <Card title="Ny kveld">
        <p className="mb-3" style={{ color: "var(--color-muted)", fontSize: "0.85rem" }}>
          Alle starter på {coins(START_COINS)} igjen. Regnskapet for kveldene som har vært blir stående under «Alle kvelder».
          {pending && " Spill som ikke er avgjort bør avgjøres først."}
        </p>
        {confirm === "night" ? (
          <div className="flex gap-2">
            <button type="button" onClick={async () => { const r = await newNight(books.users, bet.night); if (!r.ok) setError(r.reason); setConfirm(null); await bet.refresh(); }} className={`glossy flex-1 rounded-lg ${FOCUS_RING}`} style={{ "--btn-fill": "var(--color-gold)", color: "var(--color-bg)", minHeight: "2.75rem", fontWeight: 700 } as React.CSSProperties}>
              Ja, start kveld {bet.night + 1}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={`tactile rounded-lg px-4 ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)" }}>
              Avbryt
            </button>
          </div>
        ) : (
          <button type="button" disabled={books.users.length === 0} onClick={() => setConfirm("night")} className={`tactile w-full rounded-lg ${FOCUS_RING}`} style={{ minHeight: "2.75rem", background: "var(--color-cell)", color: "var(--color-cream)", border: "1px solid var(--color-border)", opacity: books.users.length === 0 ? 0.5 : 1 }}>
            Start ny kveld
          </button>
        )}
      </Card>
    </>
  );
}

function HowItWorks() {
  return (
    <details className="mb-8 rounded-xl p-4" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <summary className="cursor-pointer" style={{ color: "var(--color-cream)", fontWeight: 600 }}>Slik fungerer det</summary>
      <ul className="mt-3 space-y-2 list-disc pl-5" style={{ color: "var(--color-cream)", fontSize: "0.9rem" }}>
        <li>Alle starter kvelden med {coins(START_COINS)} mynter. Det er bare på morro.</li>
        <li>Det er ingen bank. Et spill er alltid mellom to av dere: du legger ut «jeg tror Kari vinner, 100 til 1,87», og en annen tar imot motsatt side.</li>
        <li>Den som tar imot risikerer innsatsen ganger oddsen minus én (87 i eksempelet). Vinneren tar hele potten.</li>
        <li>Oddsen oppdateres etter hver runde på tre piler. Et spill ingen har tatt imot før neste runde, trekkes tilbake av seg selv.</li>
        <li>Når kampen er over, betales potten ut av seg selv.</li>
        <li>Under Regnskap ser du hvem som skylder hvem når kvelden er slutt.</li>
      </ul>
    </details>
  );
}
