# Devpost submission draft (English)

Checklist from the [CSC Back-to-School rules](https://csc-back-to-school.devpost.com/):
project name, problem, what it does, demo/website link, tools used, AI-use disclosure, team
member names, source code. Opt in to the CSC Innovation Awards (public repo, permission to feature).
Deadline: **October 5, 2026, 00:00 PDT = 09:00 in Italy**. Team: max 4, ages 13-18.

Fill the `[ ]` placeholders before submitting.

---

## Project name

Recapp

## Tagline

Three school apps. One card. Missed a day? Open yesterday, and see what's due next.

## The problem

At ITI G. Marconi in Verona, class information lives in three disconnected systems: ClasseViva
(the official gradebook), Google Classroom and the school's Campus platform. None of them is
complete, so every evening the class chat asks the same questions: what's the homework, is there
a test, where is the file. And when you're absent, nothing tells you what happened in the lab:
which repository, which command broke, what to bring next time.

It affects every student who misses a lesson, and the classmates who answer the same questions
every night.

## What it does

Recapp is a class hub written by the students who were there:

- **One card per school day**, written by a rotating note-taker after the bell: what each subject
  covered, a lab block (goal, repo, the trap to avoid, what to bring) and what was assigned.
- **Upcoming**: one list of homework, tests and events, with countdowns on tests.
- **Fair rotation**: the turn moves every school day and skips weekends and holidays from the
  official school calendar. The app shows "Gianni is today's note-taker and hasn't published yet";
  if nothing is published by 18:00, anyone can take the turn.
- **Pre-filled from the real timetable** of our two classes: lab hours open the lab block
  automatically and "next lesson" dates are computed for each subject.
- **AI drafts, human decisions**: paste a line or a cropped screenshot from ClasseViva/Classroom/
  Campus and AI turns it into draft items; the note-taker accepts or edits each one.
- **Listen** button, Italian/English interface, light/dark theme, read-only school area for the headteacher.
- **By subject** view to catch up after a week of absence, replies and corrections under each day,
  and a share image for the class chat (subjects and deadlines only, no nicknames).

## How we built it

- React 19 + TypeScript + Tailwind on the frontend, FastAPI + SQLModel on the backend.
- One Render web service (Docker) serves the app and the API on our domain bassaleo.xyz.
- Postgres on Neon.
- **Render Workflows** runs the AI extraction as a separate task (`extract_items`), calling
  **Featherless** models (Qwen3-VL-8B for screenshots, Qwen3-30B for pasted text).
- 25 automated tests (pytest), also run against Postgres.

## Challenges

- Choosing *not* to connect to the gradebook: ClasseViva has no public API and storing minors'
  school passwords would be dangerous. We designed around it instead.
- Making AI reliable with dates: models confused weekdays until we gave them an explicit school
  calendar; every date is still validated and dubious ones are highlighted.
- Making sure someone actually writes: rotation, a visible status and the 18:00 open turn.

## What we learned

[ Write 3-4 sentences in your own words: e.g. timezones (UTC vs Europe/Rome bug we found),
privacy-by-design, testing on real data, deploying with Docker and DNS. ]

## What's next

Pilot with classes 4AI and 4BI; with the school's approval, read-only Google Classroom
integration and importing the timetable from the school's timetable service; end-of-year
data deletion.

## Built with

React, TypeScript, Vite, Tailwind CSS, TanStack Query, FastAPI, SQLModel, Pydantic, Pillow,
Postgres (Neon), Docker, Render (web service + Workflows), Featherless (Qwen3-VL-8B-Instruct,
Qwen3-30B-A3B-Instruct-2507), Web Speech API, gen.xyz domain, Cursor (AI coding assistant).

## Links

- Website: https://bassaleo.xyz (press "Try the demo")
- Source code: https://github.com/xFurti/Recapp
- Video: [ link ]

## AI-use disclosure

**While building**: we used Cursor, an AI coding assistant, to discuss the plan, write large parts
of the code (backend, React pages, tests, deployment files) and debug it. The team decided the
product and its rules: the problem, not connecting to the gradebook, the privacy limits, the
note-taker rotation and the 18:00 takeover, the screens. We reviewed and ran the code, tested it
with our real timetables and on the live site, and reported the bugs we found back into the
process. [ Add here which parts each member wrote, changed or tested themselves. ]

**Inside the product**: Featherless models, run through Render Workflows, turn a pasted line or a
cropped screenshot into draft items. The AI never publishes: a student accepts, edits or discards
each draft, and unusual dates are flagged. Without an AI key the app falls back to a rule-based
parser. The Listen button uses the browser's built-in speech synthesis.

## Team

[ Name Surname ] · [ Name Surname ] · [ Name Surname ] — 4th year Computer Science, ITI G. Marconi, Verona.

---

## How the project maps to the judging criteria

| Criterion | Where to point the judges |
| --- | --- |
| Learning | AI disclosure above, `docs/` folder, challenges section; be ready to explain rotation, day states and the AI validation |
| Design | Screenshots in the README, mobile layout, clear daily status banner, IT/EN |
| Creativity | The lab block ("the trap to avoid"), rotation with 18:00 takeover, refusing to scrape the gradebook |
| Functionality | Live site with demo, real timetables, 16 tests, AI on Render Workflows |
| Impact | Real pilot in two classes agreed with the headteacher; who it helps and why |
