## Publication attribution

`card-attribution.spec.ts` opens the real application routes and mocks only HTTP responses. It checks Today, the day card, archive and subject page in Italian and English, on desktop and phone, for demo and official class layouts. It verifies the original author's Share/Edit controls, omission of the updater after an author's own edit, draft attribution, admin preview, the spoken text and attribution drawn into the actual sharing canvas. The API suite separately exercises publication and edits in real demo and official classes, including permissions, counts, item authors, conflicts and migration of historical data. PR screenshots use the production build with a local API and an isolated database.

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

## Navigation indicator

`navigation.spec.ts` mounts the real `AppShell` (and `ClassNavigation`) in StrictMode with BrowserRouter, so URL changes and Back/Forward use browser history. Page bodies are small route labels; unrelated API responses are simulated. It checks the 240ms transform transition, alignment with the active link, no movement of link bounds, rapid navigation without accumulating transitions, initial deep links, hiding on editor/subject/archive routes, hover, keyboard focus and activation, existing icon animations, both themes, reduced motion, translation and breakpoint changes.

The desktop and phone PR videos are recorded separately in the full production build, using a local FastAPI instance and its real demo data. Upload media directly to the PR with `gh pr comment --attach` or `gh pr edit --attach`; do not commit new recordings to the repository.

## Page transition

`page-transition.spec.ts` mounts the real `AppShell` under `createBrowserRouter` in StrictMode, as in production, with small pages for Oggi, Ieri, In arrivo, Classe and an editor whose changes cannot be saved. Only HTTP responses are mocked, with configurable latency and errors. It checks that the old page is frozen and covered while the new one mounts and starts loading at once; the total duration (`COVER_MS + REVEAL_MS`); the wipe direction on desktop and phone; header and navigation staying interactive; rapid clicks and Back/Forward settling on one consistent URL, page and selection; no transition on first load, filters, language or theme; slow data and errors never left covered; refused navigations; focus on the new heading; reduced motion; and the light and dark colors.

The desktop and phone PR videos are recorded from the dev build with the local API and its demo data, and attached to the PR, not committed.

## 404 mini game

`magilla.spec.ts` mounts the real `MagillaGame` (the Magilla Gorilla runner on the 404 page) in StrictMode. It checks that Space starts the run and the score climbs, that a crash shows the catchphrase and Play again and saves the best score, Escape pause and Space resume, that keys pressed on other controls are ignored, the remembered sound toggle, tap-to-start and the hold-to-duck pad on a phone, and dark theme with reduced motion.

## Upcoming item corrections

`item-corrections.spec.ts` mounts the real Upcoming, Today, ItemForm and correction panels in AppShell and StrictMode. HTTP responses alone are simulated. It covers required reasons, sparse proposals, editing a pending request, privacy, current/proposed comparisons, multiple requests surviving acceptance and date regrouping, author/admin actions, rejection notes, already-fixed requests, error/retry and pending states, the inbox on Today, and outcomes for the requester. Layout and keyboard checks cover 320px, 390px and desktop, Italian/English, demo/official class context, light/dark, reduced motion, focus containment/restoration, 16px mobile inputs and a shortened viewport representing the keyboard. The proposal never includes a time.

Run `npm run test:e2e -- item-corrections.spec.ts`. The API suite in `api/tests/test_item_corrections.py` separately checks real permissions, audit persistence, atomic decisions, sparse updates, unchanged author/attachments/day attribution, cross-class isolation, validation, past/draft items, and independence from day feedback, for both demo and official classes.

Issue #64 screenshots are captured from the production build with an isolated local API and real demo/official accounts, then attached directly to the PR. Chromium viewport checks do not replace checking the physical keyboard and focus zoom in iPhone Safari.
