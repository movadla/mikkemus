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

/** Colours written as hex or rgb in a component. Most of what was here is now a token; what is left is art (the board, the
 *  confetti, the trophy, the shirts) and stays as it is. The number per file can go down and never up. */
const COLOUR_LITERALS: Record<string, number> = {
  "app/kamp/[id]/page.tsx": 1,
  "app/layout.tsx": 1,
  "app/storskjerm/page.tsx": 7,
  "components/BracketTree.tsx": 3,
  "components/BullDuelGameScreen.tsx": 6,
  "components/BullDuelWinnerScreen.tsx": 11,
  "components/ChalkboardScreen.tsx": 1,
  "components/ConfirmDialog.tsx": 1,
  "components/DartboardHeatmap.tsx": 10,
  "components/DrawScreen.tsx": 1,
  "components/FxMenu.tsx": 1,
  "components/FxStage.tsx": 51,
  "components/GameScreen.tsx": 12,
  "components/KitSettings.tsx": 5,
  "components/KnockoutOverview.tsx": 1,
  "components/LineupIntro.tsx": 9,
  "components/MatchInsights.tsx": 2,
  "components/MomentumWave.tsx": 5,
  "components/NightStory.tsx": 10,
  "components/PlayerSheet.tsx": 1,
  "components/PlayerStatsAccordion.tsx": 18,
  "components/RatingCard.tsx": 3,
  "components/RecordsTab.tsx": 1,
  "components/ReplayCard.tsx": 1,
  "components/RowDartsChart.tsx": 1,
  "components/SeedingTab.tsx": 4,
  "components/StatsLineChart.tsx": 3,
  "components/TeamKit.tsx": 2,
  "components/ThrowerBar.tsx": 3,
  "components/TimeMachine.tsx": 4,
  "components/TripleCelebration.tsx": 2,
  "components/Trophy.tsx": 14,
  "components/WinnerScreen.tsx": 6,
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
