# Recapp

**Missed a day? Catch up with your class. One shared recap, notes and upcoming deadlines.**

Built by three fourth-year Computer Science students at ITI G. Marconi, Verona, Italy, for the [CSC Back-to-School Hackathon](https://csc-back-to-school.devpost.com/).

[Try Recapp](https://bassaleo.xyz) · [Submission story](docs/devpost.md) · [Credits and AI use](docs/credits.md) · [Technical documentation](docs/README.md)

Open the website and select **Try the demo** to explore without a school account.

> **Project status:** Recapp is a student prototype currently being tested by its team. We discussed the idea with our headteacher and plan to present the developed project after the competition. A possible pilot with two or three classes and any school adoption still need to be agreed. The timetables in the prototype do not imply that those classes are already participating in a pilot.

## Why we built it

At our school, information is spread across **ClasseViva**, **Google Classroom** and **Campus**, the school's learning platform. Homework and reminders are not always recorded in the electronic register. After missing a day, a student may need to check several places to find out what happened, what to study and what to bring next time.

Recapp gives classmates a shared starting point. A rotating student note-taker writes a recap after school, adds notes and assignments, and preserves practical details from lab lessons. Students who attended can use it too, to compare notes and see upcoming deadlines together. We hope sharing the responsibility will encourage classmates to help one another.

## What you can do

| View or feature | Purpose |
| --- | --- |
| **Today** | See the day's lessons, whose turn it is to write and whether the recap has been published. |
| **Yesterday** | Read the latest published day, with subject summaries, notes, attachments and lab details. |
| **Upcoming** | Find homework, tests and events by date; keep a personal checklist on the current device. |
| **By subject** | Revisit recaps for one subject when catching up. |
| **Write the day** | Start from the timetable, add notes and deadlines, then review and publish. |
| **Lab blocks** | Record the goal, repository or link, a mistake to avoid and what to bring next time. |
| **Replies and Share** | Suggest corrections under a recap or export a summary image for the class chat. |
| **Class** | Consult members, note-taking turns and the timetable. |
| **School area** | Provide staff access to class content and administrative tools for class setup and the calendar. |

The interface supports Italian and English, light and dark themes, desktop and mobile layouts, and a guided first-visit tour. **Listen** uses browser speech synthesis where available; playback depends on the browser and installed voices.

### A day with Recapp

1. The note-taking turn rotates on school days, using the configured timetable and calendar.
2. After school, the note-taker opens **Write the day**. The timetable pre-fills subjects and lab blocks.
3. They summarize lessons, attach appropriate notes, add reminders and set homework or test dates. Suggested dates can be reviewed and changed.
4. They can paste text or upload a cropped screenshot from a school platform to obtain draft items through the configured extraction provider. Each draft can be accepted, edited or discarded.
5. **Publish** makes the reviewed recap and its items available to the class. If the day remains unpublished after **18:00**, another classmate can take over; the note-taker can also pass the turn earlier.

Recapp does not log into or automatically synchronize the official school platforms. Classmates write the recap, and the official platforms remain the reference for school information.

## Screenshots

Interface captures from development live in [docs/screenshots](docs/screenshots). The numbered gallery (`02-oggi-verbalista.png` and the rest of that set) is not in the repository, so this page does not embed those files.

## How it is built

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router, react-i18next |
| Backend | FastAPI, SQLModel, SQLite locally; PostgreSQL supported for deployment |
| Documented hosting setup | Docker on Render, Neon PostgreSQL. Public site: [bassaleo.xyz](https://bassaleo.xyz). [tryrecapp.xyz](https://tryrecapp.xyz) is a second address on the same service while its DNS verification finishes. |
| Extraction | Configurable Featherless text/vision models; offline text parser and simulated image output for local use |
| Background work | Optional Render Workflows `extract_items` task, with in-process execution also supported |
| Speech | Browser Web Speech API |
| Verification tooling | pytest, Playwright, TypeScript production build, oxlint |

AI providers, model identifiers and task execution depend on the environment configuration. The repository supports live AI, but an offline or simulated result is not evidence that a model ran. See [configuration](.env.example), [deployment](DEPLOY.md) and [the extraction pipeline](docs/ai-e-ocr.md).

```text
web/            React interface and browser tests
api/            FastAPI routes, data model, permissions and scheduling
api/tasks.py    Extraction and offline parsing
api/workflow.py Render Workflows entry point
api/tests/      API tests
scripts/        Local development helpers
docs/           Technical documentation, submission and credits
```

## Run locally

Requirements: Python 3.12, [uv](https://docs.astral.sh/uv/) and Node.js 22+ with npm.

```bash
./scripts/dev.sh
```

The script installs dependencies and starts the API at `http://localhost:8000` and the frontend at `http://localhost:5173`. Local defaults use SQLite, an offline rule-based text parser, simulated image extraction and in-process tasks; no AI key is required. Dependency installation requires network access.

- Select **Try the demo** to explore the sample class.
- Local school-area credentials are `preside` / `demo` at `/scuola`; these are development defaults, not production credentials.
- The development/demo clock can simulate time to explore the daily states.
- On first startup, the console prints class codes and initial admin invitations. Keep invitations private.

After local setup, run the backend checks:

```bash
.venv/bin/python -m pytest api/tests -q
```

Frontend checks:

```bash
cd web
npm run build
npm run lint
npx playwright install chromium ffmpeg
npm run test:e2e
```

Browser-test setup and coverage are described in [web/tests/README.md](web/tests/README.md). Test totals change as the project evolves; use the output from the version being tested rather than a fixed count here.

## Data and access

Class access uses a class code, nickname and personal PIN, with an invitation for initial activation. The application includes authorization checks, hashed PINs and invitations, request limits, and image re-encoding to remove metadata. See [security and privacy](docs/sicurezza-privacy.md) for implementation details and limitations.

Students should not upload grades, private school credentials, names or faces in screenshots. Removing image metadata does not remove information visible in an image. When live extraction is enabled, selected text or images and class context are sent to the configured provider. Review the material before submitting it and check the resulting drafts before publishing.

## Team and project story

| Member | Role |
| --- | --- |
| [Leonardo Bassanello](https://github.com/xFurti) | Team coordinator, project originator, developer |
| [Luca Cremonese](https://github.com/PiEnneGi) | Developer, beta tester, bug testing |
| [Oleksii Holovan](https://github.com/Oleksi-Holovan) | Developer, beta tester, video creator |

We formed the team on **September 20, 2026**, discussed our ideas with the headteacher on **September 21**, and built Recapp from scratch for the competition. This was our first project together as a team of three. We are particularly proud of translating our ideas into an interface close to what we imagined while coordinating around school, sports and other commitments.

After the competition, we hope to adapt the project with school feedback and agree on a small classroom pilot. School Google-account sign-in is a possible future improvement, not an existing feature. Read the [full project story](docs/devpost.md).

## AI use

Our team supplied the initial ideas and product direction. **Cursor** helped with planning and initial implementation; **Cursor and Claude** supported subsequent development and bug fixes. **Codex** also assisted with implementation, debugging, tests, reviews and documentation. AI contributed substantially to the code. **ChatGPT** helped generate the Recapp logo and some graphics, with some results edited manually by the team.

This development assistance is separate from the app's optional **Featherless** extraction: it prepares draft items for human review and never publishes a recap on its own. The offline parser, simulated image output and browser speech synthesis are also distinct from live generative AI.

See [credits and AI use](docs/credits.md) for roles and asset details. The demo video is being finalized; production credits will be added with the final link.

## License and school logo

The project code is available under the [MIT license](LICENSE). The **ITI G. Marconi Verona logo belongs to the school and is excluded from that license**; the code license grants no permission to reuse it.

Our computer science teacher confirmed that we could display the school logo in this student project. Its presence does not indicate school adoption or an approved pilot. Third-party resources retain their own licenses; see [credits](docs/credits.md).
