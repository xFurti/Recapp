# Issue #132 — Desktop widths

Production builds served by the local API with an isolated demo database.
No HTTP mocks. The demo class uses simulated time 2026-10-16 18:30 in
Europe/Rome. The tour and the release popup are dismissed.

Before images are from base `6cc6421d909ce58fc4fd887566f326e238573cb1`.
After images are from the production build in this PR. Same data, viewport,
language and theme.

| Viewport | Size |
| --- | --- |
| Desktop | 1440×1000 |
| Phone | 390×844 and 320×844 |

Languages: Italian and English. Themes: light and dark. Views: editor,
weekly timetable and a published reading day.

Files are named `{before|after}-{editor|timetable|reading}-{1440|390|320}-{light|dark}-{it|en}.png`.

Reading pages stay on a 768px measure, so those pairs should look the same.
The editor and class pages widen to 1152px. Notes stay in a column of at most
736px. The index is beside the lessons on a wide desktop and above them on a phone.

Full-page phone captures also paint the fixed header and tab dock into the long
image. The live viewport is what `web/tests/page-widths.spec.ts` checks,
including 200% text. These viewport captures show that screen directly:

- [Editor at 200% on a 320px phone](after-editor-200-viewport-320-light-it.png)
- [Editor at 200% on a 1440px desktop](after-editor-200-viewport-1440-light-it.png)
- [Class page at 200% on a 320px phone](after-class-200-viewport-320-light-it.png)

Oggi's two-column layout stays in #96 / PR #99 and is not part of these images.
