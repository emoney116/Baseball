export type ThemePreference = "dark" | "light";

const PROFILE_THEME_STORAGE_PREFIX = "clubhouse9-theme:";
const LAST_THEME_STORAGE_KEY = "clubhouse9-theme:last";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light";
}

function profileThemeKey(profileId: string) {
  return `${PROFILE_THEME_STORAGE_PREFIX}${profileId}`;
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
    const lastTheme = readLastTheme();
    if (!lastTheme) return undefined;
    if (!profileId || lastTheme.profileId === profileId) return lastTheme.theme;
  } catch {
    return undefined;
  }
  return undefined;
}

export function saveStoredTheme(profileId: string | undefined, theme: ThemePreference) {
  if (typeof window === "undefined") return;
  try {
    if (profileId) window.localStorage.setItem(profileThemeKey(profileId), theme);
    window.localStorage.setItem(LAST_THEME_STORAGE_KEY, JSON.stringify({ profileId, theme }));
  } catch {
    // Theme preference is a convenience; blocked storage should not affect app use.
  }
}

export function applyDocumentTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem("${LAST_THEME_STORAGE_KEY}") || "null");
    const theme = parsed && (parsed.theme === "dark" || parsed.theme === "light") ? parsed.theme : null;
    if (theme) document.documentElement.dataset.theme = theme;
  } catch {}
})();
`;
