import Anthropic from "@anthropic-ai/sdk";
import { validateFacts } from "@/lib/matchSummary";

/**
 * Turns the facts of a finished match into a few sentences of Norwegian commentary.
 *
 * The facts come from the browser (see lib/matchSummary.ts) and are the only thing the model is
 * given to write from — which is the whole defence against it inventing a story. Everything that
 * can fail does so quietly from the player's side: with no API key, a refusal, an error or a
 * limit hit, the answer is an empty 4xx/5xx and the winner screen keeps the rule-based text it
 * already shows.
 *
 * The model is `claude-opus-5-5` unless SUMMARY_MODEL says otherwise — a summary is short, so a
 * cheaper model can be swapped in from the environment without touching code.
 */
const MODEL = process.env.SUMMARY_MODEL || "claude-opus-5-5";

const MAX_BODY_BYTES = 24_000;

/** The route is open (the app has no logins), so it is capped per caller. In-memory, so it is
 *  per server instance — good enough to stop a loop, not a guarantee. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function limited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 2000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  return false;
}

const SYSTEM = `Du er kommentator for dartspillet «Mikke Mus» (Mickey Mouse-dart): hver spiller eller hvert lag skal lukke radene 20, 19, 18, 17, 16, 15, 14, D (dobbel), T (trippel) og BULL. En rad lukkes med et visst antall kryss («target» i dataene). En trippel gir tre kryss, en dobbel to. Treff-prosent er kryss per kastet pil.

Du får fakta om en ferdigspilt kamp som JSON. Skriv en kort oppsummering på norsk (bokmål): 2 til 4 setninger, ren tekst uten overskrifter, punktlister eller emojier. Fortell hvordan kampen utviklet seg: hvem som startet bra, hvem som slet og med hvilken rad, om ledelsen skiftet, og hvordan vinneren avgjorde. Bruk bare tall og navn som står i dataene. Ikke finn på detaljer som ikke kan leses ut av dem. Hvis dataene ikke viser noen tydelig utvikling, si det enkelt i stedet for å pynte. Navn på lag og spillere skal skrives akkurat som i dataene.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Not configured: the winner screen keeps its own text. Not an error worth logging per match.
    return new Response(null, { status: 503 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip, Date.now())) return new Response(null, { status: 429 });

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const facts = validateFacts(parsed);
  if (!facts) return new Response(null, { status: 400 });

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      // Thinking is always on for this model; low effort keeps a three-sentence answer cheap and quick.
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `Fakta om kampen:\n${JSON.stringify(facts)}` }],
    });
    if (response.stop_reason === "refusal") return new Response(null, { status: 204 });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!text) return new Response(null, { status: 204 });
    return Response.json({ text });
  } catch (error) {
    // Typed errors first, so a rate limit is not logged as a bug; nothing about the failure is
    // sent back to the browser, which only needs to know there is no AI text this time.
    if (error instanceof Anthropic.RateLimitError) return new Response(null, { status: 429 });
    if (error instanceof Anthropic.APIError) {
      console.error("Oppsummering: Claude API-feil", error.status, error.message);
      return new Response(null, { status: 502 });
    }
    console.error("Oppsummering: uventet feil", error);
    return new Response(null, { status: 500 });
  }
}
