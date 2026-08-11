const DEFAULT_PRODUCTION_SITE_URL = "https://clubhouse9sports.com";

function normalizeSiteUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function productionSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_PRODUCTION_SITE_URL;
}

export function requestSiteUrl(request: Request) {
  if (process.env.VERCEL_ENV === "production") return productionSiteUrl();
  return normalizeSiteUrl(new URL(request.url).origin) ?? productionSiteUrl();
}

export function browserSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
    ?? (typeof window !== "undefined" ? normalizeSiteUrl(window.location.origin) : undefined);
}

export function absoluteUrl(path = "/", base = productionSiteUrl()) {
  return new URL(path, `${base}/`).toString();
}
