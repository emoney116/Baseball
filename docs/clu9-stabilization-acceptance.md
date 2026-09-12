# Stabilization Acceptance Ledger

Status: **In progress; not accepted for Player rollout.**

This consolidates the chronological evidence in `clu9-stabilization-2026-09-12.md`. A passing local test is not proof of a hosted email flow; viewport emulation is not physical Safari testing.

## Main And Reconciliation

- Latest fetched main: `8754d8b` (rechecked after `84015ea`). Integration branch: `feature/clu9-ui-player-stabilization`.
- Campbell's listed Ask Clubhouse, Live BP, chart, staff and migration commits remain ancestors. Prior CLU9-42 work was selectively reconciled, not blindly merged.
- Migration checkpoint: 68 local/hosted migrations matched; no migrations added by this pass. No production promotion or main merge.
- Latest verified application preview: https://baseball-g7zh1yapv-emoney116s-projects.vercel.app (`84015ea`).

## Theme And Select System

| Requirement | Evidence | Acceptance Limit |
| --- | --- | --- |
| Light/dark text and selected states | Semantic brand ink, selected foreground, muted and field overlay tokens; deterministic contrast tests | Not an automated contrast proof for every rendered component |
| Shared family | Select, searchable select, multiselect, picker, segmented control and option overlay; current ChoiceSelect callers retained | Specialized exceptions documented separately |
| Search, Apply/Clear/Cancel, keyboard and focus | Maintained selector runner; 30 size/theme cases plus interaction checks | Development fixture, supplemented by hosted callers |
| Anchoring and clipping | Shared viewport positioning; hosted Analytics 10 Filters and 6 Events/Columns cases | No physical Safari chrome/keyboard proof |
| Navigation layering | Both-theme hosted More menu outside dismissal and orientation closure | Representative navigation, not every possible overlap |
| Player Profile edit target | Final preview: ten size/theme cases, 44x44, unobstructed, no horizontal overflow | Coach profile control only |
| Forms, tables and charts | Populated roster, settings, import draft, planning draft, Analytics and Ask reviews in evidence log | Remaining nested workflow audit is not implicitly accepted |

## Player Acceptance

| Requirement | Current Evidence | Status |
| --- | --- | --- |
| Signup and verification | Public signup rejects reserved fake addresses; no fresh account created | External inbox required |
| Login/session | Existing controlled QA accounts authenticated and used across hosted workflows | Passed for existing accounts |
| Forgot/reset password | No actual delivered recovery link completed | External inbox required |
| Team search and claim | Hosted pending, duplicate, rejection, reclaim, approval and revoked access checks; fresh pending/rejected states passed eight phone/iPad theme captures with representative visual review | API/data flow and waiting/rejection visual checks passed; invite continuation separate |
| Invite creation | Normal coach API accepted request; provider accepted send; QA invite revoked afterward | Not delivery proof |
| Redemption/auto-link | Database tests cover wrong email, expiry, unknown/revoked/used token, exact existing identity, identity reuse, wrong account and inactive membership | Hosted successful redemption remains unverified |
| Multi-team | Hosted canonical identity and isolated team contexts/policies | Passed controlled fixtures |
| Access modes | View Only, Track & View and Full Player exercised separately from policy | Hosted controlled fixtures passed |
| Tracking policy | Live Only versus Personal + Live; downgrade stops writes | Hosted controlled fixtures passed |
| Player Home | Corrected active-practice selection and missing-number labels; populated responsive review | Representative states passed |
| Live tracking | Own hitting, pitching, defense and workout sets; end/revoke/downgrade boundaries | Hosted controlled fixtures passed |
| Personal tracking | Own three domains saved/reloaded, isolated from team events | Hosted controlled fixtures passed |
| Analytics/Ask | Own scope and charts; private/other-player requests denied; coach BP prose plus three visuals | Hosted controlled fixtures passed |
| Security | RLS/API negative tests, private notes denied, forged/cross-player writes denied | No security weakening; real invite lifecycle still needs hosted proof |

## Responsive Evidence

- Requested viewports: 390x844, 430x932, 820x1180, 1180x820 and 1440x900, both themes.
- Player route matrix: 50 corrected geometry/context checks. Coach matrix: 84 captures, not all accepted as populated states; loading/empty captures are explicitly excluded from broad claims.
- Live BP basic wizard: 50 step/size/theme checks. Complex runner/error expansions are not covered by that count.
- Add Team selectors: 40 cases. Player mode/policy settings: 20. Profile crop action: 12 including short viewport. Relevant representative screenshots reviewed.
- Physical iPhone/iPad Safari/PWA hardware unavailable. Emulation cannot accept hardware keyboard, browser chrome or standalone-PWA behavior.

## Quality And Release

- Latest full local run: build and 906/906 tests passed for `0b75dc7`; tsc and lint passed (26 existing image warnings). `84015ea` only strengthens CSS selector specificity and passed Vercel build plus ten hosted geometry/hit checks.
- Latest runtime dependency audit: zero production advisories. Development-tool advisories remain documented in the chronological log; not claimed resolved.
- CLU9-70, CLU9-42 and CLU9-46 remain In Progress. No issue marked Done based merely on code presence.
- Branch pushed without force; unrelated local documents preserved. Main untouched.

## Remaining

- **External acceptance blocker:** deliverable controlled inbox for fresh signup, verification, password recovery and successful invite redemption. Fake accounts cannot substitute for these proofs.
- **Unverified physical acceptance:** real Safari/PWA smoke, explicitly unavailable on this host.
- **Repository/QA remaining:** finish uncovered nested visual states, especially invitation continuation and coach tracking forms; strengthen coverage where review reveals defects. Do not equate the route matrix with all workflows.
- **Final gate:** rerun full quality on the final code revision and consolidate Linear acceptance before rollout. No automatic main merge.

Ready for Player rollout: **NO**.
