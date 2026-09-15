import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isAppleSafari, isStandalone, isNewBuild, INSTALL_DISMISSED_KEY } from "../app/lib/pwa.ts";
import { GET } from "../app/api/app-version/route.ts";
import { APP_NAME, APP_SHORT_NAME, BRAND_ASSETS } from "../app/lib/branding.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
test("install instructions target Safari iPhone and desktop-mode iPad, not alternate browsers", () => {
  assert.equal(isAppleSafari(phone, 5), true);
  assert.equal(isAppleSafari("Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.0 Safari/605.1.15", 5), true);
  assert.equal(isAppleSafari("Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.0 Safari/605.1.15", 0), false);
  assert.equal(isAppleSafari(phone.replace("Version/18.0", "CriOS/138.0"), 5), false);
  assert.equal(isAppleSafari(phone.replace("Version/18.0", "FxiOS/138.0"), 5), false);
  assert.equal(isAppleSafari("Android Chrome/138.0 Safari/537.36", 5), false);
});
test("standalone supports both standard and Apple detection", () => {
  assert.equal(isStandalone(true, false), true);
  assert.equal(isStandalone(false, true), true);
  assert.equal(isStandalone(false), false);
});
test("only distinct valid deployment revisions trigger an update", () => {
  const current = "a".repeat(40);
  assert.equal(isNewBuild(current, "b".repeat(40)), true);
  for (const value of [current, null, {}, "unversioned", "<html>login</html>"]) assert.equal(isNewBuild(current, value), false);
  assert.equal(isNewBuild(undefined, "b".repeat(40)), false);
});
test("version response is public build identity only and cannot be cached", async () => {
  const response = GET();
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("Vercel-CDN-Cache-Control"), "no-store");
  assert.deepEqual(Object.keys(await response.json()), ["version"]);
});
test("installed branding remains global and full name", () => {
  assert.equal(APP_NAME, "Clubhouse 9");
  assert.equal(APP_SHORT_NAME, "Clubhouse 9");
  const manifest = read("app/manifest.ts");
  assert.match(manifest, /start_url: "\/\?view=home"/);
  assert.match(manifest, /scope: "\/"/);
  assert.match(manifest, /id: "\/"/);
  assert.match(manifest, /display: "standalone"/);
  assert.doesNotMatch(manifest, /organization|Metrolina|team=/i);
});
for (const [key, size] of [["icon180", 180], ["icon", 192], ["icon512", 512]]) {
  test(`official ${size}px PNG is correctly sized`, () => {
    const png = readFileSync(new URL(`../public${BRAND_ASSETS[key]}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  });
}
test("Safari metadata preserves zoom and uses the global touch icon", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /apple:.*BRAND_ASSETS.icon180/);
  assert.match(layout, /manifest: "\/manifest.webmanifest"/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /statusBarStyle: "default"/);
  assert.doesNotMatch(layout, /maximumScale|userScalable:\s*false/);
});
test("install dismissal persists and update never refreshes automatically", () => {
  assert.equal(INSTALL_DISMISSED_KEY, "clubhouse9:install-dismissed:v1");
  const source = read("app/components/PwaHomeNotice.tsx");
  assert.match(source, /localStorage.setItem\(INSTALL_DISMISSED_KEY, "1"\)/);
  assert.match(source, /!standalone\(\) && !dismissed/);
  assert.match(source, /if \(canRefresh && !document.querySelector/);
  assert.match(source, /confirmRefresh \?/);
  assert.equal((source.match(/window.location.reload\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /serviceWorker|caches\.|beforeinstallprompt/);
  assert.match(read("app/page.tsx"), /canRefresh=\{saveStatus !== "saving" && saveStatus !== "error" && !practiceTrackingOpen\}/);
});
