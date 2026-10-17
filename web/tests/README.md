## Initial interface language

`initial-language.spec.ts` opens the real landing route and simulates only HTTP responses and browser language preferences. It checks saved-choice priority, ordered browser preferences, regional tags, missing/empty lists, invalid saved values, English fallback, detection on each reload, and manual choices persisting after reload and browser preference changes. A DOM observer checks the heading, selector and document language at the first React render, including mobile dark theme. Automatic detection must leave saved language storage untouched. `language.spec.ts` continues to cover the existing manual transition and preservation of authored text, focus, selection, scroll and open dialogs.

Run `npm run test:e2e -- tests/initial-language.spec.ts tests/language.spec.ts`. Issue #80 screenshots use production builds and a real local API without mocked HTTP responses; the same fresh Italian browser context is used before and after the change.

## Publication attribution

`card-attribution.spec.ts` opens the real application routes and mocks only HTTP responses. It checks Today, the day card, archive and subject page in Italian and English, on desktop and phone, for demo and official class layouts. It verifies the original author's Share/Edit controls, omission of the updater after an author's own edit, draft attribution, admin preview, the spoken text and attribution drawn into the actual sharing canvas. The API suite separately exercises publication and edits in real demo and official classes, including permissions, counts, item authors, conflicts and migration of historical data. PR screenshots use the production build with a local API and an isolated database.

## Mobile item form

`item-form.spec.ts` opens the real Upcoming and day editor routes, including AppShell and ItemForm, with only HTTP responses mocked. It covers all four item types at 320px and 390px, both languages and themes, focus on every available control, 16px mobile fonts, saving with the selected day and no time, unchanged background position, scroll/style/focus restoration, Tab containment and dismissal. The checks also work with the date-only form from PR #68; that PR owns removal of the time field and its dedicated date tests. Keyboard-related checks resize the layout viewport and separately simulate visual viewport height/offset events; these do not open a physical keyboard. Desktop checks preserve 15px fields and the centered sheet. The viewport meta tag remains unrestricted, and Chromium also checks a page scale of 2.

Run `npm run test:e2e -- tests/item-form.spec.ts` for Chromium, or install Chromium and WebKit with `npx playwright install chromium webkit` and run `npm run test:e2e -- --config playwright.item-form.config.ts` for both engines with touch/mobile emulation. Optional executable overrides are `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH`.

Issue #62 screenshots use production builds with a local API and isolated demo database, without mocked HTTP responses. Integration captures with PR #68 are labelled explicitly. Short viewport screenshots illustrate the available space; they do not show an iOS keyboard. Physical iPhone Safari focus zoom, keyboard dismissal and pinch gestures still need a device check.

# Message deletion browser tests

These tests render the real `Feedback` component with React StrictMode and React Query. Only the HTTP responses are mocked, allowing deterministic network latency and errors without altering application data. The API suite separately verifies deletion permissions against the real backend.

```sh
cd web
npm ci
npx playwright install chromium ffmpeg
npm run test:e2e
```

To use an existing Chromium installation:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The tests cover cancellation by button, close, Escape and backdrop; focus containment and restoration; selected-message preview; ownership controls; pending state and duplicate requests; errors, dismissal and retry; desktop/mobile and light/dark layouts; English labels and reduced motion. The recording test attaches a short WebM showing cancellation, error, retry, pending state and success.

A converted MP4 recording is committed at `docs/media/issue-19-delete-message.mp4` and linked in the PR. The harness is outside `src` and is not included in the production build.

## Calendar export

`calendar.spec.ts` renders the real Upcoming, Today, day card and subject pages inside AppShell. It checks all four item types, Italian/English, demo/official class context, desktop/phone, both themes, menu position above mobile navigation, keyboard focus and dismissal, unchanged done/link/attachment controls, Google links and downloaded `.ics` files. Date checks cover Rome, Los Angeles and Kiritimati. `calendar-export.spec.ts` also covers leap years, month/year boundaries, daylight saving dates, private data exclusion, text escaping and UTF-8 line folding. Run `npm run test:e2e -- tests/calendar.spec.ts tests/calendar-export.spec.ts`.

These automated checks do not authenticate to Google or import into Apple Calendar. Actual import on iPhone/Mac needs a manual check: export an item, compare its all-day date and text with Recapp, and confirm it can be saved.

## Lesson status browser tests

`lesson-status.html` mounts the real Editor and AppShell with routing, React Query and StrictMode. Only HTTP responses are mocked. The tests cover stored status, radio keyboard navigation and visible focus, independent lesson groups, autosave, reopening a draft, preview and publication. They verify that changing status preserves points, lab data, notes and both lesson/day attachment IDs. Layout checks cover desktop/mobile, light/dark themes, English labels, long subject names, enlarged text and reduced motion.

Run with the same `npm run test:e2e` command above. This harness is outside the production entry point. The issue #28 screenshots and recordings use the production build and a local API with isolated demo data; they are attached directly to the PR, outside the repository.

## Item dates

`item-dates.spec.ts` mounts the real Upcoming, Today and Editor pages with AppShell, routing, React Query and StrictMode. Only HTTP responses are mocked. It checks all four item types without a time control, full-width date inputs at 320px, 390px and desktop in Italian/English and light/dark themes, date suggestions and manual selection, POST/PATCH payloads with `due_time: null`, legacy times hidden in rows and cleared on editor autosave, preservation of lesson and attachment data, preview, and imported times discarded on direct acceptance or editing.

Run just this suite with `npm run test:e2e -- item-dates.spec.ts`. The harness stays outside the production build.

## Navigation indicator

`navigation.spec.ts` mounts the real `AppShell` (and `ClassNavigation`) in StrictMode with BrowserRouter, so URL changes and Back/Forward use browser history. Page bodies are small route labels; unrelated API responses are simulated. It checks the 240ms transform transition, alignment with the active link, no movement of link bounds, rapid navigation without accumulating transitions, initial deep links, hiding on editor/subject/archive routes, hover, keyboard focus and activation, existing icon animations, both themes, reduced motion, translation and breakpoint changes.

The desktop and phone PR videos are recorded separately in the full production build, using a local FastAPI instance and its real demo data. Upload media directly to the PR with `gh pr comment --attach` or `gh pr edit --attach`; do not commit new recordings to the repository.

## Page transition

`page-transition.spec.ts` mounts the real `AppShell` under `createBrowserRouter` in StrictMode, as in production, with small pages for Oggi, Ieri, In arrivo, Classe and an editor whose changes cannot be saved. Only HTTP responses are mocked, with configurable latency and errors. It checks that the old page is frozen and covered while the new one mounts and starts loading at once; the total duration (`COVER_MS + REVEAL_MS`); the wipe direction on desktop and phone; header and navigation staying interactive; rapid clicks and Back/Forward settling on one consistent URL, page and selection; no transition on first load, filters, language or theme; slow data and errors never left covered; refused navigations; focus on the new heading; reduced motion; and the light and dark colors.

The desktop and phone PR videos are recorded from the dev build with the local API and its demo data, and attached to the PR, not committed.

## 404 mini game

`magilla.spec.ts` mounts the real `MagillaGame` (the Magilla Gorilla runner on the 404 page) in StrictMode. It checks that Space starts the run and the score climbs, that a crash shows the catchphrase and Play again and saves the best score, Escape pause and Space resume, that keys pressed on other controls are ignored, the remembered sound toggle, tap-to-start and the hold-to-duck pad on a phone, and dark theme with reduced motion.

## Weekly timetable scrolling

`timetable.spec.ts` opens the actual Class page with deterministic HTTP responses for the five-day, seven-period 4BI timetable. At 320px and 390px, in both themes and languages, it holds native Chromium touch gestures mid-scroll and checks that no lesson is painted over the fixed period column, including the row gutters. It checks whole-day alignment after release, at both ends and after resizing; the overflow hint; the same behavior while editing; opening and saving the correct Friday period; and the existing Day view. Desktop checks verify that the week fits without scrolling or a hint. Issue #66 screenshots are attached directly to the PR.

## Upcoming item corrections

`item-corrections.spec.ts` mounts the real Upcoming, Today, ItemForm and correction panels in AppShell and StrictMode. HTTP responses alone are simulated. It covers required reasons, sparse proposals, editing a pending request, privacy, current/proposed comparisons, multiple requests surviving acceptance and date regrouping, author/admin actions, rejection notes, already-fixed requests, error/retry and pending states, the inbox on Today, and outcomes for the requester. Layout and keyboard checks cover 320px, 390px and desktop, Italian/English, demo/official class context, light/dark, reduced motion, focus containment/restoration, 16px mobile inputs and a shortened viewport representing the keyboard. The proposal never includes a time.

Run `npm run test:e2e -- item-corrections.spec.ts`. The API suite in `api/tests/test_item_corrections.py` separately checks real permissions, audit persistence, atomic decisions, sparse updates, unchanged author/attachments/day attribution, cross-class isolation, validation, past/draft items, and independence from day feedback, for both demo and official classes.

Issue #64 screenshots are captured from the production build with an isolated local API and real demo/official accounts, then attached directly to the PR. Chromium viewport checks do not replace checking the physical keyboard and focus zoom in iPhone Safari.

## Theme toggle

`theme-toggle.spec.ts` exercises the actual landing and privacy pages and both AppShell header variants through the existing navigation harness, with HTTP responses mocked. It checks both directions from either saved theme, storage and remounting, the 32px button and 28px language flag without header movement, 500ms rotation/scale transitions with a 200ms incoming delay, independent page color blending, keyboard focus and Italian/English accessible names, rapid reversals, and immediate swaps with reduced motion. PR screenshots and desktop/phone videos are captured separately from the production build and a local API using isolated demo data, then uploaded directly to GitHub.

## Lab notes (issue #81)

`lab-notes.html` mounts the real Editor, AppShell, published card and Upcoming routes. Only HTTP responses are mocked. The dedicated Chromium/WebKit suite covers IT/EN, light/dark, 320px/1280px, keyboard focus when adding/removing the optional link, multiline notes, autosave, reopening, preview, publication, timetable defaults, the empty-publication guard, legacy conversion/editing/clearing, dated materials in Upcoming, speech text and the shared image's LAB badge.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --config playwright.lab.config.ts
```

Omit the executable override when using Playwright's bundled Chromium. A local WebKit wrapper can be selected with `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` when the host needs external browser libraries. Screenshots in `docs/screenshots/issue-81/` use production builds and a real local API with an isolated demo database; the before images come from the original base. The electronics example includes dated materials using the existing assignment flow. WebKit on Linux is a browser-engine check, not a physical iPhone test.

## What's new history

`releases.spec.ts` also mounts the real `/novita` page with a 13-release history spread over five months, including a release published at 23:30 UTC, with only HTTP responses mocked. It checks case- and accent-insensitive search on titles, descriptions and versions, the release count, highlighted and dimmed notes, the empty state and clearing; day and inclusive period filters on the UTC card date, combined with search and kept in the URL across reloads; month navigation and the return to the latest updates; opening and closing cards from the keyboard; `#release-<id>` links that open a collapsed note or clear the filters hiding it, landing below the sticky header on desktop and phone; and the controls at 320px in Italian and English, both themes and reduced motion. PR screenshots are captured from the dev build with mocked releases.
## Class contributions and Grazie

`contributions.spec.ts` opens the real Classe, Contributi della classe, Oggi and In arrivo routes inside AppShell; only HTTP responses are mocked, with a small in-memory server state for Grazie. It covers the compact streak card above the Classe tabs (count, record, the last school days with their state in words as well as icons), keyboard navigation to the Contributi view with focus on its heading, period, shared first place and ties, the viewer's highlighted row reached with "Vai alla tua posizione" and kept clear of the header and the phone tab bar, the counting rules disclosure, and the return to Classe with focus restored. It also checks the all-zero state without a winner or positions, the empty class with the invitation to start, and error/retry on both the card and the view. On items it toggles Grazie with Enter and Space, verifies that the same item shown in the day and in "soon" keeps one counter, that one's own items and days show a read-only count, the size and placement next to the calendar action at 320px, 390px and desktop, refreshed leaderboard data, Italian/English, light/dark and reduced motion.

Run `npm run test:e2e -- tests/contributions.spec.ts`. The API suite in `api/tests/test_contributions.py` separately checks attribution, uniqueness, withdrawal, self-thanks (blocked and legacy rows ignored), cross-class and draft isolation, school/anonymous access, aggregation with ties, inactive members, the period and deleted items, the punctual streak (open today, missed and late days, holidays, timezone, days before the class joined), the item publication backfill, and the demo seed. Issue #79 screenshots come from the production build served by a local API with isolated demo and official-class data.

Regression checks also inspect individual text bounds and overlaps in every ranking row at 320px, 390px and desktop, in both languages, at 100% and 200% text size. They exercise shared pending state across duplicate item buttons and client-side navigation, independent items, and a server save whose response fails: all copies reconcile with the saved state. These use delayed or failed HTTP responses; the PR screenshots use the real local API without mocked data.

## Contributions podium and motion

`contributions.spec.ts` opens the real Classe, Contributi, Today and Upcoming routes with deterministic HTTP responses. The 41 cases run on Chromium and WebKit: single/paired/three-place podiums, competition positions for ties, members still at zero Grazie kept off the podium, a compact 24-person group and keyboard expansion, every member appearing once, personal focus within and beyond the podium (also after promotion, without pulling focus back once the user has left the row), animated counters, genuine record detection and deduplication across refetch/navigation/reload, lower recalculated records, and changes to reduced-motion preferences. Layout checks cover 320/390/1280px, Italian/English, both themes, long unbroken names and 200% text, including text overlap and clipping. Existing Grazie and empty/error-state checks remain in the suite.

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --config playwright.contributions.config.ts
```

Install WebKit with `npx playwright install webkit`, or set `PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH` to an existing launcher. Browser fixtures simulate HTTP responses only; they do not change counting rules. Issue #90 screenshots and video use production builds with the real local API and an isolated SQLite demo database. The recording includes a real Grazie changing the podium and a real publication advancing the streak and record; no HTTP responses are mocked in those captures. See `docs/screenshots/issue-90/README.md` for the original base and capture details.
