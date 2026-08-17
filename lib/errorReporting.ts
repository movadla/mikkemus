import { useSyncExternalStore } from "react";

export type Toast = { id: number; message: string };

const DEFAULT_TTL_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const activeKeys = new Map<string, number>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const EMPTY_ARRAY: never[] = [];

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function scheduleDismiss(id: number, ttlMs: number) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(id, setTimeout(() => dismissToast(id), ttlMs));
}

/**
 * Fire-and-forget visible feedback for a failed save/fetch — the one place every data-layer
 * function in this app reports a failure the user should actually see, instead of only
 * console.error (which is what every one of these call sites did before this existed).
 *
 * Calls are deduped by `key` (defaults to the message itself): a repeated failure with the same
 * key refreshes the existing toast's timer instead of stacking a new one. This matters a lot for
 * something like publishLiveMatch, which fires on every dart thrown during an active match — an
 * outage there must read as one steady toast, not a wall of banners appearing once per throw.
 */
export function reportError(message: string, opts?: { key?: string; ttlMs?: number }) {
  const key = opts?.key ?? message;
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const existingId = activeKeys.get(key);
  if (existingId !== undefined && toasts.some((t) => t.id === existingId)) {
    scheduleDismiss(existingId, ttlMs);
    return;
  }
  const id = nextId++;
  activeKeys.set(key, id);
  toasts = [...toasts, { id, message }];
  notify();
  scheduleDismiss(id, ttlMs);
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  for (const [key, tid] of activeKeys) {
    if (tid === id) activeKeys.delete(key);
  }
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function getToasts(): Toast[] {
  return toasts;
}

export function useErrorToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getToasts, () => EMPTY_ARRAY);
}
