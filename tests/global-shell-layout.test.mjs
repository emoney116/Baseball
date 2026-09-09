import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("appearance is a single labeled theme-control row", () => {
  const setting = page.slice(page.indexOf('<article className="panel account-settings-card">'), page.indexOf("<PlayerAccountLinksPanel"));
  assert.match(setting, /<strong>Appearance<\/strong>\s*<SegmentedControl/);
  assert.doesNotMatch(setting, /Used everywhere|<strong>Theme|panel-heading/);
  const layouts = [...css.matchAll(/\.account-appearance-setting \{([^}]+)\}/g)];
  assert.equal(layouts.length, 2);
  for (const [, rules] of layouts) assert.match(rules, /grid-template-columns: minmax\(0, 1fr\) auto/);
});

test("profile and Home omit organization cards", () => {
  const profile = page.slice(page.indexOf("function AccountProfileView("), page.indexOf("type AvatarCropState"));
  assert.doesNotMatch(profile, /My Organizations|<OrganizationCard|account-teams-card/);
  assert.match(profile, /<PlayerAccountLinksPanel/);
  const home = page.slice(page.indexOf("function ClubhouseHome("), page.indexOf("function OrganizationsView("));
  assert.doesNotMatch(home, /title="My Organizations"/);
});

test("account sign out is secondary below identity and team discovery", () => {
  assert.match(page, /title="My Profile"\s*className="account-profile-header"/);
  assert.match(css, /\.account-profile-header\.section-header \{[^}]*flex-direction: row;/);
  const profile = page.slice(page.indexOf("function AccountProfileView("), page.indexOf("type AvatarCropState"));
  assert.ok(profile.indexOf('className="global-sign-out"') > profile.indexOf("<PlayerAccountLinksPanel"));
});

test("global profile banner is shared outside team context", () => {
  assert.match(page, /!inTeamContext && \(\s*<header className="global-home-banner"/);
  assert.equal(page.split('className="global-home-banner"').length - 1, 1);
  assert.match(page, /goToView\("account"\).*aria-label="Open profile"/);
});

test("My Teams uses the compact header and its View all opens teams", () => {
  const teams = page.slice(page.indexOf("function MyTeamsView("), page.indexOf("function TeamCreatorModal("));
  assert.match(teams, /className="global-primary-header"/);
  const home = page.slice(page.indexOf("function ClubhouseHome("), page.indexOf("function OrganizationsView("));
  assert.match(home, /onView\("teams"\)\}>View all/);
});

test("Home shows only pinned teams under one My Teams heading and creation lives in the banner", () => {
  const home = page.slice(page.indexOf("function ClubhouseHome("), page.indexOf("function OrganizationsView("));
  assert.equal(home.split('title="My Teams"').length - 1, 1);
  assert.match(home, /groups\.pinned\.map\(renderTeam\)/);
  assert.doesNotMatch(home, /title="Pinned Teams"|groups\.remaining|global-create-button|onCreateTeam/);
  const banner = page.slice(page.indexOf('<header className="global-home-banner"'), page.indexOf('</header>', page.indexOf('<header className="global-home-banner"')));
  assert.match(banner, /globalCreationCapabilities\(data.teamContext\).canCreateTeam/);
  assert.match(banner, /aria-label="New team or organization"/);
});

test("followed organization rows retain intrinsic height inside scroll lists", () => {
  const list = css.match(/^\.organization-team-card__list \{[^}]+\}/m)?.[0] ?? "";
  assert.match(list, /grid-auto-rows: max-content/);
  assert.match(list, /align-content: start/);
});

test("global header has a circular create button and dismissible empty notifications popover", () => {
  const banner = page.slice(page.indexOf('<header className="global-home-banner"'), page.indexOf('</header>', page.indexOf('<header className="global-home-banner"')));
  assert.ok(banner.indexOf('popoverTarget="global-notifications"') < banner.indexOf('className="primary-button global-create-button"'));
  assert.match(banner, /id="global-notifications" popover="auto"/);
  assert.match(banner, /No new notifications/);
  assert.match(css, /\.global-home-banner-actions \.global-create-button \{ border-radius: 50%; \}/);
});

test("team cards use concise season and relationship metadata", () => {
  const managed = page.slice(page.indexOf("function ManagedTeamCard("), page.indexOf("function PublicOrganizationFollowCard("));
  assert.match(managed, /const metadata = \[team.seasonName/);
  assert.match(managed, /team.playerContextId \? "Player" : roleLabel\(team.role\)/);
  const publicCard = page.slice(page.indexOf("function PublicTeamFollowCard("), page.indexOf("function OrganizationMiniRow("));
  assert.match(publicCard, /const metadata = team.seasonName \?\? "Current season"/);
});

test("organization previews cap compact chips and Search omits them", () => {
  assert.match(page, /chipLabel\(team\)\.length <= 18\)\.slice\(0, 3\)/);
  assert.match(page, /previewChips=\{false\}/);
  assert.match(page, /\+\{extraTeams\} more/);
  assert.match(css, /\.global-home \{[^}]*padding-bottom: calc\(120px \+ env\(safe-area-inset-bottom\)\)/);
});

test("creation fields align without nested dropdown padding and explain visibility", () => {
  assert.match(css, /\.team-creator-modal \.form-choice \{ padding: 0/);
  assert.match(css, /grid-template-columns: 96px minmax\(0, 1fr\)/);
  assert.match(page, /<span>Org Name<\/span>/);
  assert.match(page, /<span>Org Photo<\/span>/);
  assert.match(page, /aria-label="About visibility"/);
  assert.match(page, /<VisibilityFieldLabel id="organization-visibility-help"/);
  assert.match(page, /bottom: window.innerHeight - rect.top \+ 8/);
});

test("local preview database notice does not replace normal production errors", () => {
  const links = fs.readFileSync(new URL("../app/components/PlayerAccountLinksPanel.tsx", import.meta.url), "utf8");
  assert.match(links, /localPreview = false/);
  assert.match(links, /localPreview && message\.startsWith\("Supabase is not configured"\)/);
  assert.match(links, /className="global-dev-notice"/);
  assert.match(page, /<PlayerAccountLinksPanel localPreview=\{isLocalDevAuthBypass\(\)\}/);
});
