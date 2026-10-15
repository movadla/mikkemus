const STORAGE_KEY = "mikke-mus-rules-intro-seen";

/** The rules introduction is shown the first time a game starts on a device, and never again
 *  unless asked for from the home screen. Per device, like every other preference here. */
export function hasSeenRulesIntro(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage blocked: better to skip the introduction than to show it before every match.
    return true;
  }
}

export function markRulesIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Nothing to do — see hasSeenRulesIntro.
  }
}

/** One slide of the written introduction: what it says, and which picture goes with it. */
export type RulesSlide = {
  id: "mal" | "kryss" | "ring" | "tur" | "vinner";
  title: string;
  text: string;
};

/**
 * Five slides, five seconds each — under half a minute in all. Kept as data, apart from the
 * component, so the wording can be read and corrected in one place. The rules they describe are
 * the standard game; the number of crosses per row can be changed at setup, which the second
 * slide says.
 */
export const RULES_SLIDES: RulesSlide[] = [
  {
    id: "mal",
    title: "Lukk alle ti radene",
    text: "Radene er 20, 19, 18, 17, 16, 15 og 14, så D for dobbel, T for trippel og til slutt BULL. Du tar dem i rekkefølge, og den første som har lukket alle vinner.",
  },
  {
    id: "kryss",
    title: "Tre kryss lukker en rad",
    text: "Hvert treff på tallet du er på gir ett kryss. Med tre kryss er raden lukket, og du går videre til neste. Antall kryss kan endres før du starter.",
  },
  {
    id: "ring",
    title: "Dobbel og trippel",
    text: "En dobbel gir to kryss og en trippel tre. Treffer du dem på tallet du er på, velger du om de teller på tallet eller på D- eller T-raden. På andre tall teller de på D- og T-raden.",
  },
  {
    id: "tur",
    title: "Tre piler per tur",
    text: "Kast tre piler, og så er det neste spiller eller lag. I lagspill kaster lagkameratene annenhver gang. Trykk Bekreft, eller ta ut pilene, når turen er ferdig.",
  },
  {
    id: "vinner",
    title: "BULL tas til slutt",
    text: "Ytre bull gir ett kryss og indre bull to. Når alle ti radene er lukket, har du vunnet.",
  },
];

/** How long each slide stays, in milliseconds. Five of them make 25 seconds. */
export const RULES_SLIDE_MS = 5000;
