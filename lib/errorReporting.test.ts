import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts, reportError } from "./errorReporting";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Clear out anything this test left behind so later tests start clean, then restore real timers.
  getToasts().forEach((t) => dismissToast(t.id));
  vi.useRealTimers();
});

describe("reportError / dismissToast", () => {
  it("adds a toast that dismissToast can remove", () => {
    reportError("Kunne ikke lagre X");
    const toast = getToasts().find((t) => t.message === "Kunne ikke lagre X");
    expect(toast).toBeDefined();

    dismissToast(toast!.id);
    expect(getToasts().some((t) => t.id === toast!.id)).toBe(false);
  });

  it("collapses repeated calls with the same key into one toast", () => {
    reportError("Kunne ikke oppdatere storskjerm-visningen.", { key: "live-match-publish" });
    reportError("Kunne ikke oppdatere storskjerm-visningen.", { key: "live-match-publish" });
    reportError("Kunne ikke oppdatere storskjerm-visningen.", { key: "live-match-publish" });

    const matching = getToasts().filter((t) => t.message === "Kunne ikke oppdatere storskjerm-visningen.");
    expect(matching).toHaveLength(1);
  });

  it("keeps unkeyed calls with different messages as separate toasts", () => {
    reportError("Feil A");
    reportError("Feil B");
    expect(getToasts().some((t) => t.message === "Feil A")).toBe(true);
    expect(getToasts().some((t) => t.message === "Feil B")).toBe(true);
  });

  it("auto-dismisses after the TTL elapses", () => {
    reportError("Forsvinner snart", { key: "ttl-test", ttlMs: 1000 });
    expect(getToasts().some((t) => t.message === "Forsvinner snart")).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(getToasts().some((t) => t.message === "Forsvinner snart")).toBe(false);
  });

  it("refreshes the TTL when the same key fires again before it expires", () => {
    reportError("Gjentatt feil", { key: "refresh-test", ttlMs: 1000 });
    vi.advanceTimersByTime(700);
    reportError("Gjentatt feil", { key: "refresh-test", ttlMs: 1000 });
    vi.advanceTimersByTime(700);
    // 1400ms since the first call, but only 700ms since the refresh — should still be showing.
    expect(getToasts().some((t) => t.message === "Gjentatt feil")).toBe(true);

    vi.advanceTimersByTime(300);
    expect(getToasts().some((t) => t.message === "Gjentatt feil")).toBe(false);
  });
});
