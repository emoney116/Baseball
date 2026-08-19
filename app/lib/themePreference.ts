export type ThemePreference = "dark" | "light";

const PROFILE_THEME_STORAGE_PREFIX = "clubhouse9-theme:";
const DEVICE_THEME_STORAGE_KEY = "clubhouse9-theme:device";
const LAST_THEME_STORAGE_KEY = "clubhouse9-theme:last";
const THEME_COOKIE_NAME = "clubhouse9-theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light";
}

function profileThemeKey(profileId: string) {
  return `${PROFILE_THEME_STORAGE_PREFIX}${profileId}`;
}

function readCookieTheme(): ThemePreference | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_NAME}=([^;]*)`));
  if (!match) return undefined;
  const value = decodeURIComponent(match[1] ?? "");
  return isThemePreference(value) ? value : undefined;
}

function saveCookieTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function readLastTheme(): { profileId?: string; theme: ThemePreference } | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAST_THEME_STORAGE_KEY) ?? "null") as { profileId?: unknown; theme?: unknown } | null;
    if (!parsed || !isThemePreference(parsed.theme)) return undefined;
    return {
      profileId: typeof parsed.profileId === "string" ? parsed.profileId : undefined,
      theme: parsed.theme,
    };
  } catch {
    return undefined;
  }
}

export function readStoredTheme(profileId?: string): ThemePreference | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    if (profileId) {
      const value = window.localStorage.getItem(profileThemeKey(profileId));
      if (isThemePreference(value)) return value;
    }
    const deviceTheme = window.localStorage.getItem(DEVICE_THEME_STORAGE_KEY);
    if (isThemePreference(deviceTheme)) return deviceTheme;
    const lastTheme = readLastTheme();
    if (lastTheme && (!profileId || lastTheme.profileId === profileId)) return lastTheme.theme;
  } catch {
    return readCookieTheme();
  }
  return readCookieTheme();
}

export function saveStoredTheme(profileId: string | undefined, theme: ThemePreference) {
  if (typeof window === "undefined") return;
  try {
    if (profileId) window.localStorage.setItem(profileThemeKey(profileId), theme);
    window.localStorage.setItem(DEVICE_THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(LAST_THEME_STORAGE_KEY, JSON.stringify({ profileId, theme }));
  } catch {
    // Theme preference is a convenience; blocked storage should not affect app use.
  }
  saveCookieTheme(theme);
}

export function applyDocumentTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const isTheme = (value) => value === "dark" || value === "light";
    let theme = window.localStorage.getItem("${DEVICE_THEME_STORAGE_KEY}");
    if (!isTheme(theme)) {
      const parsed = JSON.parse(window.localStorage.getItem("${LAST_THEME_STORAGE_KEY}") || "null");
      theme = parsed && isTheme(parsed.theme) ? parsed.theme : null;
    }
    if (!isTheme(theme)) {
      const match = document.cookie.match(/(?:^|; )${THEME_COOKIE_NAME}=([^;]*)/);
      theme = match ? decodeURIComponent(match[1]) : null;
    }
    if (isTheme(theme)) document.documentElement.dataset.theme = theme;
    if (isTheme(theme)) document.documentElement.style.colorScheme = theme;
  } catch {}
})();
`;
