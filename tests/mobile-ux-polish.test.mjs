import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mobile workspace polish keeps shared controls compact and team aware", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const visuals = readFileSync("app/components/visuals.tsx", "utf8");
  const repository = readFileSync("app/data/supabaseRepository.ts", "utf8");

  assert.match(page, /className="icon-button team-workspace-back"/);
  assert.doesNotMatch(page, /className="team-switcher-home-row"/);
  assert.match(page, /function NumberWheelCell/);
  assert.match(page, /label="Height" value=\{heightToInches\(form\.height\) \|\| 72\} min=\{36\} max=\{107\}/);
  assert.match(page, /label="Weight" value=\{form\.weight \?\? 175\} min=\{1\} max=\{500\}/);
  assert.match(page, /title="Team Player Photo"/);
  assert.match(page, /className="roster-status-select"/);
  assert.match(page, /\["All", "Varsity", "JV", "MS"\]/);
  assert.match(page, /className="weight-room-mobile-player-select"/);
  assert.match(page, /className="analytics-title-actions"/);
  assert.match(page, /<DensePlayerIdentity player=\{row\.player\} \/>/);
  assert.doesNotMatch(page, /\{sample && <small>\{sample\}<\/small>\}/);

  assert.match(visuals, /src=\{player\.teamImageUrl \?\? player\.imageUrl\}/);
  assert.match(repository, /teamImageUrl: membership\?\.metadata\?\.teamImageUrl/);
  assert.match(css, /\.player-avatar--player\.player-avatar--initials/);
  assert.match(css, /\.weight-room-athlete-workspace \.weight-room-player-list\s*\{\s*display:\s*none/);
  assert.match(css, /\.schedule-side \.schedule-detail-card:has\(\.schedule-detail-card__close\)/);
  assert.match(css, /\.weight-room-score-drawer\s*\{[\s\S]*position:\s*fixed/);
});
