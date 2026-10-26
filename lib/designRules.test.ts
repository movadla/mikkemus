import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The rules that keep the screens looking like one app, as tests, so a change that breaks them is stopped where it is made:
 * the colours come from the tokens, nothing is set smaller than 12 px, and there are no emoji in what is drawn.
 */

const ROOT = process.cwd();

function sources(dir: string, pattern: RegExp): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? sources(rel, pattern) : pattern.test(e.name) && !/\.test\./.test(e.name) ? [rel] : [];
  });
}

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** Colours written as hex or rgb in a component. Everything that could be a token is one (a shadow is a mix of --shade, an accent a mix
 *  of its own token, so each follows the theme). What is left is art: the effects canvas (FxStage), the trophy's metal, the
 *  heat map's ramp, the shirts, and a few chart series chosen to stay apart. The number per file can go down and never up. */
const COLOUR_LITERALS: Record<string, number> = {
  "app/kamp/[id]/page.tsx": 1,
  "app/layout.tsx": 1,
  "app/storskjerm/page.tsx": 1,
  "components/BullDuelGameScreen.tsx": 1,
  "components/DartboardHeatmap.tsx": 8,
  "components/FxStage.tsx": 51,
  "components/KitSettings.tsx": 5,
  "components/ui/BotFace.tsx": 11,
  "components/LineupIntro.tsx": 6,
  "components/MomentumWave.tsx": 5,
  "components/NightStory.tsx": 9,
  "components/RatingCard.tsx": 2,
  "components/RecordsTab.tsx": 1,
  "components/ReplayCard.tsx": 1,
  "components/RowDartsChart.tsx": 1,
  "components/SeedingTab.tsx": 1,
  "components/StatsLineChart.tsx": 3,
  "components/TeamKit.tsx": 8,
  "components/ThrowerBar.tsx": 3,
  "components/TimeMachine.tsx": 2,
  "components/Trophy.tsx": 14,
  "components/WinnerScreen.tsx": 4,
};

/** Transitions written with their own milliseconds in a component, where the three motions (--spring, --pull, --weight) or the durations
 *  (--duration-*) of the tokens should be. What is left is a mark being drawn, the PIN pad, and a few show moments (the line-up, the
 *  night story, the rating table, the big screen). The number per file can go down and never up. */
const MOTION_LITERALS: Record<string, number> = {
  "app/storskjerm/page.tsx": 1,
  "components/LineupIntro.tsx": 1,
  "components/Mark.tsx": 3,
  "components/NightStory.tsx": 1,
  "components/PinGate.tsx": 1,
  "components/RatingCard.tsx": 1,
};

/** The breathing glows (animate-idle-glow, animate-column-glow) in the screens: one glow per screen, so no file gains one. What is left is the
 *  light behind the mascot and behind a winner, and the breathing round the cell that is aimed at. The number per file can go down and never up. */
const GLOW_USES: Record<string, number> = {
  "app/storskjerm/page.tsx": 3,
  "components/BullDuelWinnerScreen.tsx": 1,
  "components/GameScreen.tsx": 1,
  "components/HeroMascot.tsx": 1,
  "components/WinnerScreen.tsx": 1,
};

const LITERAL = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(/g;

const SCREENS = () => [...sources("components", /\.tsx$/), ...sources("app", /\.tsx$/)];

describe("design rules", () => {
  it("keeps colours in the tokens: no file gains a literal, and no new file has one", () => {
    const over: string[] = [];
    for (const file of SCREENS()) {
      const count = (read(file).match(LITERAL) ?? []).length;
      const allowed = COLOUR_LITERALS[file] ?? 0;
      if (count > allowed) over.push(`${file}: ${count} (allowed ${allowed})`);
    }
    expect(over).toEqual([]);
  });

  it("keeps motion in the three tokens: no file gains a transition with its own milliseconds", () => {
    const over: string[] = [];
    for (const file of SCREENS()) {
      const count = read(file)
        .split(/\r?\n/)
        .filter((line) => /transition[A-Za-z]*: .*\d+m?s/.test(line) && !/var\(--(duration|pull|spring|weight)/.test(line)).length;
      const allowed = MOTION_LITERALS[file] ?? 0;
      if (count > allowed) over.push(`${file}: ${count} (allowed ${allowed})`);
    }
    expect(over).toEqual([]);
  });

  it("keeps to one glow per screen: no file gains a breathing glow", () => {
    const over: string[] = [];
    for (const file of SCREENS()) {
      const count = (read(file).match(/animate-(idle|column)-glow/g) ?? []).length;
      const allowed = GLOW_USES[file] ?? 0;
      if (count > allowed) over.push(`${file}: ${count} (allowed ${allowed})`);
    }
    expect(over).toEqual([]);
  });

  it("gives every player colour a value in both themes", () => {
    const css = read("app/globals.css");
    for (let i = 1; i <= 8; i++) expect((css.match(new RegExp(`--player-${i}:`, "g")) ?? []).length, `--player-${i}`).toBe(2);
  });

  it("sets no text smaller than 12 px", () => {
    const small: string[] = [];
    for (const file of SCREENS()) {
      read(file)
        .split(/\r?\n/)
        .forEach((line, i) => {
          for (const m of line.matchAll(/fontSize: "([0-9.]+)rem"/g)) if (parseFloat(m[1]) < 0.75) small.push(`${file}:${i + 1}`);
        });
    }
    expect(small).toEqual([]);
  });

  it("draws no emoji: icons come from the icon set", () => {
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/u;
    const found: string[] = [];
    for (const file of [...sources("components", /\.tsx?$/), ...sources("app", /\.tsx?$/), ...sources("lib", /\.ts$/)]) {
      read(file)
        .split(/\r?\n/)
        .forEach((line, i) => {
          const code = line.trim();
          // Comments may name an emoji (the old names carried a medal); what is drawn may not.
          if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) return;
          if (EMOJI.test(code)) found.push(`${file}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});
