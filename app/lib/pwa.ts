export const INSTALL_DISMISSED_KEY = "clubhouse9:install-dismissed:v1";

export function isAppleSafari(userAgent: string, maxTouchPoints = 0) {
  const appleMobile = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return appleMobile && /Version\/[\d.]+.*Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(userAgent);
}

export function isStandalone(displayModeMatches: boolean, navigatorStandalone?: boolean) {
  return displayModeMatches || navigatorStandalone === true;
}

export function isNewBuild(current: string | undefined, next: unknown) {
  return typeof current === "string" && /^[a-f0-9]{40}$/.test(current) && typeof next === "string" && /^[a-f0-9]{40}$/.test(next) && next !== current;
}
