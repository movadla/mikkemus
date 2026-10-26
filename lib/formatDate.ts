/**
 * Dates and times as the app writes them, everywhere: "I dag", "I går", then the weekday and the day ("Søndag 25. oktober"), with the
 * year only when it is not this one. A time follows when there is one ("I går 23:08"). The ISO date (2026-10-25) is for sorting
 * and for the line under a title, never the headline.
 */
const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

const two = (n: number) => String(n).padStart(2, "0");
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** A date from "2026-10-25" (a day, read as that day here) or a full timestamp. */
function toDate(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
}

/** "I dag", "I går", "Søndag 25. oktober" or "Søndag 25. oktober 2025". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = toDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "I dag";
  if (days === 1) return "I går";
  const text = `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The clock time, "23:08". */
export function timeLabel(iso: string): string {
  const d = toDate(iso);
  return Number.isNaN(d.getTime()) ? "" : `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "I går 23:08" — the day and the time of a match. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  return `${dayLabel(iso, now)} ${timeLabel(iso)}`.trim();
}

/** The ISO day, "2026-10-25", for the small line under a heading. */
export function isoDay(iso: string): string {
  const d = toDate(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}
