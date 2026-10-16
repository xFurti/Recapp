# Issue #80 — Initial browser language

Real production builds served by FastAPI with an isolated local SQLite database.
No HTTP mocks, signed-in accounts or class data. Each capture uses a fresh Chromium
context with `locale: 'it-IT'`, no saved language, the light theme and reduced motion.
Desktop viewport: 1280×900; phone viewport: 390×844 (full-page capture).

The before screenshots are from base commit `0c414ccbec1cf1856c8008e03524806eb1dce494`.
The after screenshots are from the final implementation in this PR. They show
automatic Italian text and the Italian flag without a manual language choice.

| View | Before | After |
| --- | --- | --- |
| Desktop | [English](before-desktop.png) | [Italian](after-desktop.png) |
| Phone | [English](before-mobile.png) | [Italian](after-mobile.png) |

Images use the repository's existing `docs/screenshots/` media convention because
the integrated browser reports `BrowserHostUnavailable`, preventing attachment
upload through an authenticated GitHub page. The PR embeds the committed images.
Screenshots illustrate the result; the automated first-render observer separately
checks that text, language selector and document language agree before a paint.
