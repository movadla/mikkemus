import { describe, expect, it } from "vitest";
import { dayLabel, isoDay, timeLabel, whenLabel } from "./formatDate";

const now = new Date(2026, 9, 26, 12, 0); // 2026-10-26, a Monday

describe("dates", () => {
  it("says today and yesterday in words", () => {
    expect(dayLabel("2026-10-26", now)).toBe("I dag");
    expect(dayLabel("2026-10-25", now)).toBe("I går");
  });

  it("gives the weekday and the day for the rest, with the year only when it is another", () => {
    expect(dayLabel("2026-10-22", now)).toBe("Torsdag 22. oktober");
    expect(dayLabel("2025-12-24", now)).toBe("Onsdag 24. desember 2025");
  });

  it("adds the time for a match", () => {
    const at = new Date(2026, 9, 25, 23, 8).toISOString();
    expect(timeLabel(at)).toBe("23:08");
    expect(whenLabel(at, now)).toBe("I går 23:08");
  });

  it("keeps the ISO day for the line under a heading", () => {
    expect(isoDay("2026-10-25")).toBe("2026-10-25");
    expect(isoDay(new Date(2026, 9, 25, 23, 8).toISOString())).toBe("2026-10-25");
  });

  it("leaves what it cannot read as it is", () => {
    expect(dayLabel("ikke en dato", now)).toBe("ikke en dato");
  });
});
