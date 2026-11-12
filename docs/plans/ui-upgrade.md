# UI upgrade — white + green responsive website

**Goal:** turn `apps/web` from a dark, phone-column app into a light, responsive website (phone → laptop). Visual design, layout, navigation, components and copy only. **No changes** to business logic, API contracts, database, auth or the safety rules.

## Slices (commit after each, with lint + typecheck + tests)
1. **Tokens & theme** — `packages/ui/src/tokens.css`: new palette, shadows, radius, type scale; delete dark mode; `color-scheme: light`; single `themeColor`; `devIndicators: false`.
2. **Components** (`packages/ui`) — Button (sizes sm/md/lg, icon-only), Card, SectionHeader, Input/Select/Textarea, OtpInput, Badge/StatusTag, Chip, Avatar, Tabs, Menu (dropdown), Sheet & Dialog (native `<dialog>`), Toast, StatCard, UsageBar, EmptyState (green line-art), Skeleton, QRCard, DoctorCard, TimelineItem, SoapSection. No Radix for menus/dialogs, to keep the chat route under its 150 kB budget.
3. **Shells** (`apps/web/src/components/shell/`) — PublicShell (header + mobile sheet + footer), AuthSplit (focused split layout for login/consent/profile), PatientShell (top navbar on md+, bottom tab bar on phone), DoctorShell (sidebar 248px → icon rail at md–lg → drawer on phone), AdminShell. Route groups `app/p/(auth)` and `app/p/(app)` so auth pages don't get the patient navbar; URLs unchanged.
4. **Pages** — `/` landing (new), login/consent/profile (split screen), `/p/home` dashboard grid, `/p/id`, pre-visit start/chat/review (720px chat + "What we've noted" side panel on laptop), new `/p/visits` and `/p/records` (empty states until Phases 2/4), `/d/today` (3-pane on laptop, list → detail on phone; **preview with fictional sample data** until Phase 2), `/admin` (stat cards + table preview).
5. **Critique & acceptance** — after-screenshots at 3 sizes, design critique + accessibility review, axe in Playwright, overflow check at 360/390/768/1024/1440/1920, Lighthouse mobile on `/` and `/p/home` against a production build.

## Files
- `packages/ui/src/tokens.css`, `packages/ui/src/components/*` (new + restyled), `packages/ui/src/index.ts`
- `apps/web/src/components/shell/*`, `apps/web/src/app/**` (route groups, pages), `apps/web/messages/*.json`
- `apps/web/next.config.ts`, `apps/web/src/app/layout.tsx`
- `apps/web/scripts/screenshots.mjs` (before/after + overflow), `docs/screenshots/ui-upgrade/{before,after}/`

## Notes
- Doctor/admin screens have no backend yet (Phase 2/5). They show clearly labelled **sample data** (fictional seed patients) so the layout can be reviewed; A/P stay empty "For doctor" (rule 5).
- Auth pages use a focused split layout (spec §4.2) instead of the full public header.

## Result (2026-11-12)
- Screenshots: `docs/screenshots/ui-upgrade/before/` and `after/` — 15 pages × phone/tablet/laptop, browser in dark mode; `after/overflow.txt`: no horizontal overflow at 360/390/768/1024/1440/1920.
- Lighthouse (mobile, production build): `docs/screenshots/ui-upgrade/lighthouse/{landing,home}.report.html` — Performance 84 / 87, Accessibility 100 / 100, Best practices 100 / 100.
- Tests: 30 Playwright E2E (incl. new `e2e/ui.spec.ts`), 277 unit/API tests, lint + typecheck green.
