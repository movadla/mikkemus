import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CHARACTERS, DEFAULT_CHARACTER, characterOf, poseFor, poseSrc } from "./characters";
import { newCareer, DEFAULT_PROFILE } from "./career";
import { normalizeCareer } from "./careerStorage";

describe("the characters", () => {
  it("have a picture for every pose they say they have", () => {
    for (const c of CHARACTERS) for (const src of Object.values(c.poses)) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
  });

  it("have a neutral pose, which the others fall back to", () => {
    for (const c of CHARACTERS) expect(c.poses.noytral, c.id).toBeTruthy();
    const c = { ...CHARACTERS[0], poses: { noytral: "/n.webp" } };
    expect(poseSrc(c, "jubel")).toBe("/n.webp");
  });

  it("are found by id, and an unknown or missing id is the first one", () => {
    expect(characterOf(DEFAULT_CHARACTER).id).toBe(DEFAULT_CHARACTER);
    expect(characterOf("finnes-ikke").id).toBe(CHARACTERS[0].id);
    expect(characterOf(undefined).id).toBe(CHARACTERS[0].id);
  });

  it("show the pose that fits what happened", () => {
    expect(poseFor(null)).toBe("noytral");
    expect(poseFor({ place: "winner", prize: 500 })).toBe("jubel");
    expect(poseFor({ place: "final", prize: 300 })).toBe("noytral");
    expect(poseFor({ place: "quarter", prize: 0 })).toBe("skuffet");
  });
});

describe("a career and its character", () => {
  it("is made with the character that is picked", () => {
    const c = newCareer("Lars", "dyktig", "2026-10-28T10:00:00.000Z", { ...DEFAULT_PROFILE, character: "c03" });
    expect(c.profile.character).toBe("c03");
  });

  it("from before there were characters gets one, and keeps what it has", () => {
    const old = { ...newCareer("Lars", "dyktig", "2026-10-28T10:00:00.000Z"), profile: { home: "garage", darts: "middels" } };
    expect(normalizeCareer(old as never).profile.character).toBe(DEFAULT_CHARACTER);
    expect(normalizeCareer({ ...old, profile: { ...old.profile, character: "ukjent" } } as never).profile.character).toBe(DEFAULT_CHARACTER);
  });
});
