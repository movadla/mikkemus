import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spotify from the browser, with no server: the Authorization Code flow with PKCE needs only a client id (no secret), so the
 * tokens live in this browser and nothing about the login passes through the app's own backend. What the app does with it is
 * small — read which device is playing and set its volume (Spotify Premium; see setSpotifyVolume).
 *
 * Needs NEXT_PUBLIC_SPOTIFY_CLIENT_ID, and the app's own address ("<origin>/") registered as a redirect URI on the Spotify
 * developer dashboard. Without the client id nothing here shows up at all (see spotifyConfigured).
 */
const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const SCOPES = "user-read-playback-state user-modify-playback-state";
const TOKEN_KEY = "mikkemus.spotify.tokens";
const VERIFIER_KEY = "mikkemus.spotify.verifier";

export const spotifyConfigured = Boolean(CLIENT_ID);

type Tokens = { access: string; refresh: string; expiresAt: number };

const redirectUri = () => `${window.location.origin}/`;

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  arr.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(48)));
}

/** The PKCE code challenge for a verifier: base64url(SHA-256(verifier)). */
export async function challengeFor(verifier: string): Promise<string> {
  return base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}
function writeTokens(t: Tokens | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode and the like: the login then only lasts until the page is closed, which is fine.
  }
}

/** Sends the browser to Spotify's login. It comes back to the app's front page with ?code=… (see finishSpotifyLogin). */
export async function startSpotifyLogin(): Promise<void> {
  if (!CLIENT_ID) return;
  const verifier = randomVerifier();
  try {
    localStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    return;
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: await challengeFor(verifier),
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  if (!CLIENT_ID) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    access: json.access_token,
    // A refresh does not always hand out a new refresh token; the old one stays valid then.
    refresh: json.refresh_token ?? body.refresh_token ?? "",
    expiresAt: Date.now() + json.expires_in * 1000 - 30_000,
  };
}

/** Run once on load: if Spotify has just sent the browser back with a code, trade it for tokens and tidy the address bar. */
export async function finishSpotifyLogin(): Promise<boolean> {
  if (!CLIENT_ID || typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) return false;
  let verifier: string | null = null;
  try {
    verifier = localStorage.getItem(VERIFIER_KEY);
    localStorage.removeItem(VERIFIER_KEY);
  } catch {
    verifier = null;
  }
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  if (!verifier) return false;
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier });
  if (!tokens) return false;
  writeTokens(tokens);
  return true;
}

export function disconnectSpotify() {
  writeTokens(null);
}

async function accessToken(): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (Date.now() < t.expiresAt) return t.access;
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh });
  if (!fresh) {
    writeTokens(null);
    return null;
  }
  writeTokens(fresh);
  return fresh.access;
}

export type SpotifyDevice = { id: string | null; name: string; volume: number | null; supportsVolume: boolean };
export type SpotifyState =
  | { kind: "off" } // not configured, or not logged in
  | { kind: "nothing" } // logged in, but nothing is playing anywhere right now
  | { kind: "device"; device: SpotifyDevice; playing: boolean };

async function api(path: string, init?: RequestInit): Promise<Response | null> {
  const token = await accessToken();
  if (!token) return null;
  try {
    return await fetch(`https://api.spotify.com/v1${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
  } catch {
    return null;
  }
}

/** What is playing right now, and on which device. 204 means no active device. */
export async function readSpotify(): Promise<SpotifyState> {
  const res = await api("/me/player");
  if (!res) return { kind: "off" };
  if (res.status === 401) {
    writeTokens(null);
    return { kind: "off" };
  }
  if (res.status === 204 || !res.ok) return { kind: "nothing" };
  const json = (await res.json()) as { is_playing: boolean; device?: { id: string | null; name: string; volume_percent: number | null; supports_volume?: boolean } };
  if (!json.device) return { kind: "nothing" };
  const d = json.device;
  // Spotify reports supports_volume = false for most phones — the volume there belongs to the phone's own buttons.
  return { kind: "device", playing: json.is_playing, device: { id: d.id, name: d.name, volume: d.volume_percent, supportsVolume: d.supports_volume !== false } };
}

/** Sets the playing device's volume, 0–100. Premium only. False if Spotify refused (no device, a device that cannot be
 *  controlled, or not Premium). */
export async function setSpotifyVolume(percent: number, deviceId?: string | null): Promise<boolean> {
  const q = new URLSearchParams({ volume_percent: String(Math.round(Math.max(0, Math.min(100, percent)))) });
  if (deviceId) q.set("device_id", deviceId);
  const res = await api(`/me/player/volume?${q}`, { method: "PUT" });
  return !!res && res.ok;
}

/**
 * Spotify state for a menu: finishes a login that has just come back, then follows what plays (refreshed on a slow poll
 * while the menu is open) and sets the volume with a short debounce so dragging a slider is not a request per pixel.
 */
export function useSpotify(active: boolean) {
  const [state, setState] = useState<SpotifyState>({ kind: "off" });
  const [volume, setVolumeState] = useState<number | null>(null);
  const [refused, setRefused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const s = await readSpotify();
    setState(s);
    if (s.kind === "device") setVolumeState((v) => v ?? s.device.volume);
  }, []);

  useEffect(() => {
    if (!active || !spotifyConfigured) return;
    let cancelled = false;
    (async () => {
      await finishSpotifyLogin();
      if (!cancelled) await refresh();
    })();
    const poll = setInterval(() => void refresh(), 8000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, refresh]);

  const setVolume = useCallback(
    (percent: number) => {
      setVolumeState(percent);
      setRefused(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const id = state.kind === "device" ? state.device.id : null;
        const ok = await setSpotifyVolume(percent, id);
        if (!ok) setRefused(true);
      }, 150);
    },
    [state],
  );

  return {
    state,
    volume,
    setVolume,
    refused,
    connect: startSpotifyLogin,
    disconnect: () => {
      disconnectSpotify();
      setState({ kind: "off" });
    },
  };
}
