import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const select = readFileSync("app/components/ClubhouseSelect.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const orgManage = readFileSync("app/org/[id]/manage/OrgManageClient.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");
const docs = readFileSync("docs/clubhouse-select-system.md", "utf8");
const visuals = readFileSync("app/components/visuals.tsx", "utf8");

test("shared select family covers single, searchable, multi, picker, segmented, and contextual surfaces", () => {
  for (const primitive of [
    "ClubhouseSelect",
    "ClubhouseSearchSelect",
    "ClubhouseMultiSelect",
    "ClubhousePicker",
    "ClubhouseSegmentedControl",
    "ClubhouseOptionSheet",
  ]) assert.match(select, new RegExp(`(?:function|const) ${primitive}`));
  assert.match(css, /--clubhouse-select-control-height:\s*44px/);
  assert.match(css, /--clubhouse-select-option-height:\s*44px/);
  assert.match(css, /--clubhouse-select-layer/);
});

test("single-select overlay supports keyboard, focus, visual viewport positioning, and selected-state scrolling", () => {
  assert.match(select, /window\.visualViewport/);
  assert.match(select, /event\.key === "Escape"/);
  assert.match(select, /\["ArrowDown", "ArrowUp", "Enter", " "\]/);
  assert.match(select, /scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(select, /aria-selected/);
  assert.match(select, /clubhouse-option-overlay__scrim/);
  assert.match(css, /body:has\(\.analytics-ask-drawer\)[\s\S]*--clubhouse-select-layer:\s*12002/);
});

test("multi-select stages choices and offers clear, cancel, and apply semantics", () => {
  const multi = select.slice(select.indexOf("export function ClubhouseMultiSelect"), select.indexOf("export function ClubhousePicker"));
  assert.match(multi, /const \[draft, setDraft\] = useState\(values\)/);
  assert.match(multi, /setDraft\(\[\]\)/);
  assert.match(multi, /Cancel/);
  assert.match(multi, /Apply/);
  assert.match(multi, /onApply\(draft\)/);
});

test("core consumers use the shared system without changing analytics filter definitions", () => {
  assert.match(page, /ClubhouseSearchSelect[\s\S]*sheetTitle="Switch team"/);
  assert.match(page, /ClubhouseMultiSelect[\s\S]*searchPlaceholder="Search games or practices\.\.\."/);
  assert.match(page, /ClubhouseOptionSheet[\s\S]*title="Filters"/);
  assert.match(page, /ClubhouseMultiSelect[\s\S]*aria-label="Filter hitting charts by pitch type"/);
  assert.match(page, /ClubhouseMultiSelect[\s\S]*aria-label="Ask Clubhouse team scope"/);
  assert.match(page, /ClubhouseSearchSelect label="Pitcher"/);
  assert.match(orgManage, /ClubhouseSelect as ChoiceSelect/);
  assert.match(page, /analytics-pitch-location-selector/);
});

test("remaining native selects are documented live-scoring exceptions", () => {
  const nativeSelects = page.match(/<select\b/g) ?? [];
  assert.equal(nativeSelects.length, 3);
  assert.match(docs, /Game Center runner destination, defensive position, and substitution retain native selects/);
  assert.match(docs, /Schedule date fields retain the platform date picker/);
});

test("mobile roster actions and player entry retain compact, labeled, touch-friendly controls", () => {
  assert.match(page, /className="secondary-button roster-header-action"/);
  assert.match(page, /className="primary-button roster-header-action"/);
  assert.match(page, /className="single-player-field__label">Number/);
  assert.match(page, /type="number"[\s\S]*inputMode="numeric"[\s\S]*min=\{min\}[\s\S]*max=\{max\}/);
  assert.match(css, /\.roster-page > \.section-header \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(css, /\.single-player-row > \.single-player-field \{[\s\S]*grid-template-columns: minmax\(82px, 0\.62fr\) minmax\(0, 1fr\)/);
});

test("player avatars use one shared neutral treatment when no photo is available", () => {
  assert.match(visuals, /variant: requestedVariant/);
  assert.match(visuals, /variant = requestedVariant \?\? avatarVariantForIdentity/);
  assert.match(visuals, /<IdentityAvatar[\s\S]*variant="neutral"/);
});

test("annotated Home and Weight Room controls use compact actions and starting-weight change", () => {
  assert.match(page, /className="primary-button global-home-add-action"/);
  assert.doesNotMatch(page, /organization-add-team-button/);
  assert.match(page, /typeof thisWeek === "number" && typeof starting === "number" \? thisWeek - starting/);
  assert.match(page, /This Week \(lb\)/);
});

test("the system documentation includes inventory, responsive behavior, and exception guidance", () => {
  assert.match(docs, /## Inventory/);
  assert.match(docs, /## Accessibility and layering/);
  assert.match(docs, /## Intentional exceptions/);
  assert.match(docs, /Phone/);
  assert.match(docs, /iPad and desktop/);
});
