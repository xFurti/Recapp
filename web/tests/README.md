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

## Navigation indicator

`navigation.spec.ts` mounts the real `AppShell` (and `ClassNavigation`) in StrictMode with BrowserRouter, so URL changes and Back/Forward use browser history. Page bodies are small route labels; unrelated API responses are simulated. It checks the 240ms transform transition, alignment with the active link, no movement of link bounds, rapid navigation without accumulating transitions, initial deep links, hiding on editor/subject/archive routes, hover, keyboard focus and activation, existing icon animations, both themes, reduced motion, translation and breakpoint changes.

The desktop and phone PR videos are recorded separately in the full production build, using a local FastAPI instance and its real demo data. Upload media directly to the PR with `gh pr comment --attach` or `gh pr edit --attach`; do not commit new recordings to the repository.
