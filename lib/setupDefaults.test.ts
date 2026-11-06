import { describe, expect, it } from "vitest";
import { FACTORY_DEFAULTS, clearSetupDefaults, loadSetupDefaults, sanitizeDefaults, saveSetupDefaults } from "./setupDefaults";

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe("saved advanced settings", () => {
  it("gives back what was saved, and nothing when nothing was", () => {
    const s = store();
    expect(loadSetupDefaults(s)).toBeNull();
    const d = { ...FACTORY_DEFAULTS, exactEntry: true, venue: "vm" as const, venueBg: true };
    expect(saveSetupDefaults(d, s)).toBe(true);
    expect(loadSetupDefaults(s)).toEqual(d);
    clearSetupDefaults(s);
    expect(loadSetupDefaults(s)).toBeNull();
  });

  it("keeps only what the setup can hold", () => {
    expect(sanitizeDefaults({ variant: "nonsense", venue: "region", exactEntry: "yes", venueBg: true })).toEqual({ ...FACTORY_DEFAULTS, venueBg: true });
    expect(sanitizeDefaults(null)).toEqual(FACTORY_DEFAULTS);
  });

  it("survives a store that is not there or holds rubbish", () => {
    expect(loadSetupDefaults(null)).toBeNull();
    expect(loadSetupDefaults({ getItem: () => "{not json" })).toBeNull();
    expect(saveSetupDefaults(FACTORY_DEFAULTS, null)).toBe(false);
  });
});
