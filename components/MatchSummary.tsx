"use client";

import { useEffect, useMemo, useState } from "react";
import { factsFingerprint, ruleBasedSummary, type MatchFacts } from "@/lib/matchSummary";

const AI_TIMEOUT_MS = 25_000;

/** The AI text is only asked for where it can be answered: set NEXT_PUBLIC_AI_SUMMARY=1 together
 *  with ANTHROPIC_API_KEY. Until then the rule-based text is the summary, and nothing is sent. */
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_SUMMARY === "1";

function cacheKey(facts: MatchFacts): string {
  return `mikke-mus-summary:${factsFingerprint(facts)}`;
}

function readCached(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCached(key: string, text: string) {
  try {
    sessionStorage.setItem(key, text);
  } catch {
    // Not remembering the text only means asking again after a reload.
  }
}

/**
 * How the match went, in a few sentences. The rule-based text is there from the first frame; if
 * the summary route answers, its text replaces it, marked as written by AI. Nothing about a
 * failed or missing AI answer is ever shown — the page just keeps the text it already has.
 */
export function MatchSummary({ facts }: { facts: MatchFacts | null }) {
  const fallback = useMemo(() => (facts ? ruleBasedSummary(facts) : ""), [facts]);
  const key = facts ? cacheKey(facts) : null;
  // Remembered per match, so a reload of the winner screen does not ask (and pay) again.
  const [aiText, setAiText] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (!AI_ENABLED || !facts || !key) return;
    const cached = readCached(key);
    if (cached) {
      queueMicrotask(() => setAiText({ key, text: cached }));
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    fetch("/api/oppsummering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(facts),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status !== 200) return;
        const data: unknown = await res.json();
        const text = data && typeof data === "object" ? (data as { text?: unknown }).text : null;
        if (typeof text === "string" && text.trim()) {
          writeCached(key, text.trim());
          setAiText({ key, text: text.trim() });
        }
      })
      .catch(() => {
        // Offline, timed out, blocked: the rule-based text stays.
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [facts, key]);

  const shown = aiText && aiText.key === key ? aiText.text : fallback;
  if (!shown) return null;
  const isAi = aiText !== null && aiText.key === key;

  return (
    <div className="shadow-panel rounded-xl p-4 mb-6" style={{ background: "var(--color-surface)" }}>
      <p className="mb-4 section-label flex items-center justify-center gap-2">
        HVORDAN GIKK DET?
        {isAi && (
          <span
            title="Skrevet av AI ut fra tallene i kampen"
            className="rounded-full px-2"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-teal)", fontSize: "var(--text-micro)", letterSpacing: "0.08em" }}
          >
            AI
          </span>
        )}
      </p>
      <p key={isAi ? "ai" : "rules"} className="animate-name-swap" style={{ color: "var(--color-cream)", fontSize: "var(--text-body)", lineHeight: 1.55 }}>
        {shown}
      </p>
    </div>
  );
}
