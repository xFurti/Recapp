# Recapp — Devpost submission

English copy prepared from the team's account on October 4, 2026. The project story is ready for review. Video completion and submission checks are tracked separately in [submission-checklist.md](submission-checklist.md).

## Project name

Recapp

## Tagline

Missed a day? Catch up with your class. One shared recap, notes and upcoming deadlines.

## Inspiration

At ITI G. Marconi in Verona, Italy, we use ClasseViva, Google Classroom and Campus, our school's learning platform. Homework and reminders are not always recorded in the electronic register. Missing a day can mean checking several places to piece together what happened, what to study and what to bring next time. Even when we attend, it helps to read a classmate's notes and see upcoming deadlines together.

We discovered the competition after it had already started. On September 20, 2026, we formed our team and began exploring ideas. Our computer science teacher encouraged us to discuss them with our headteacher and build something that could remain useful beyond the competition. We met her the following day, and Recapp stood out among the ideas we discussed. We then chose to develop it from scratch for this competition.

## What it does

Recapp is a shared daily recap written by the students who were in class. A different student takes the note-taking turn each school day and writes the recap after school. It brings together what happened in each subject, shared notes, reminders and assignments.

For example, the note-taker can record materials needed for tomorrow's mathematics lesson, add an Italian test for next week, and explain what the class did in the lab. Lab blocks include the goal, repository or link, a mistake to avoid and what to bring next time.

- **Today** shows the note-taker, the day's lessons and publication status.
- **Yesterday** shows the latest published recap. **By subject** helps classmates find earlier material for a particular subject.
- **Upcoming** brings homework, tests and events together by date, with a personal checklist on the current device.
- **The editor** starts from the class timetable and supports shared notes and attachments. The note-taker can paste text or upload a cropped screenshot from a school platform and request draft items to review, edit or discard before publishing.
- **Shared responsibility** comes from a rotating turn, with a takeover option after 18:00 if the day has not been published.
- **Replies and sharing** let classmates suggest corrections and export a recap image for the class chat.

The interface supports Italian and English, light and dark themes, and desktop and mobile layouts. A Listen button uses browser speech synthesis where available. The school area provides staff access to class content and administrative tools for class setup and the calendar.

Recapp is a student-written companion to the official school platforms. It does not automatically log into or synchronize with ClasseViva, Classroom or Campus. We hope sharing the writing responsibility will encourage classmates to help one another.

## How we built it

We built the application with React, TypeScript and Tailwind CSS on the frontend, and FastAPI with SQLModel on the backend. The repository supports SQLite for local development and PostgreSQL for deployment. The documented hosting setup uses Docker on Render and Neon PostgreSQL. We also registered tryrecapp.xyz. Last-minute problems with that domain led us to keep [bassaleo.xyz](https://bassaleo.xyz) as the public site, for stability and reliability.

The extraction pipeline supports Featherless models for text and screenshots, with model identifiers supplied through configuration. It can run as an `extract_items` task on Render Workflows or inside the web service. Local defaults use a rule-based text parser and simulated image output; these are not model inference. Every extracted item remains a draft until the student reviews it and publishes the recap.

Our workflow combined team planning, AI-assisted implementation and testing. The repository includes pytest API tests, Playwright browser tests, a TypeScript production build and lint checks. The AI-use disclosure below describes the tools and our contributions.

## Challenges we ran into

Time was one of our biggest challenges: we discovered the competition after it had already started, and we had to coordinate development around school, sports and other commitments. This was also our first project together as a team of three, so we had to learn how to organize our work.

We encountered bugs along the way and resolved them by analyzing the problems. We also challenged ourselves to consider different students' perspectives, aiming to make Recapp useful beyond our own individual needs.

## Accomplishments that we're proud of

We are especially proud of Recapp's interface: it came close to what we had imagined, and seeing our ideas take shape was rewarding. We also learned to coordinate as a team and turn those ideas into a working app.

Regardless of the competition's outcome or whether our school adopts it, we believe the project is worth developing further. We hope it can eventually help students in other schools and countries who face similar challenges.

## What we learned

This was our first project as a team of three, and we learned how to work together and combine our different perspectives. Luca became more confident using Cursor, while all of us gained a better understanding of which AI models to use for different tasks. Building something for a school problem we experience every day made the project especially meaningful and enjoyable. Above all, we learned how valuable it is to involve the people who will actually use what we build, because their experiences help reveal what matters in practice.

## What's next for Recapp

We are currently testing Recapp within our team. Our headteacher has heard the idea and asked us to keep her updated; the school has not yet adopted the application or agreed to a classroom pilot.

After the competition, we plan to present the developed project, gather feedback and adapt it to the school's needs. We hope to agree on a pilot with two or three classes before considering wider use. Possible improvements include signing in with school Google accounts and additional measures for use within the school. These steps still need to be discussed and agreed with the school; school-account sign-in is not a current feature.

## Built with

React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router, react-i18next, FastAPI, SQLModel, Pydantic, Pillow, SQLite, PostgreSQL, Neon, Docker, Render, Render Workflows integration, Featherless integration, Web Speech API, pytest, Playwright, oxlint, gen.xyz, Cursor, Claude, Codex, ChatGPT.

## Links

- [Website and demo](https://bassaleo.xyz) — select **Try the demo**.
- [Demo video](https://youtu.be/vZPQf7frLNk).
- [Source code](https://github.com/xFurti/Recapp).
- [Product screenshots](https://github.com/xFurti/Recapp/tree/main/docs/screenshots).

Paste `https://youtu.be/vZPQf7frLNk` into the Devpost video field. The remaining checks are in [submission-checklist.md](submission-checklist.md).

## AI-use disclosure

**Planning and development.** Our team collected the original ideas and defined the problem from our experience as students. We used AI to expand those ideas and explore possible architectures. Planning and initial implementation started in Cursor; we then used Cursor and Claude to help implement features, fix bugs and improve the application. AI contributed substantially to implementation. Codex also assisted with code changes, debugging, tests, reviews and documentation, including preparing this submission from our answers. We tested the application within the team and used the issues we found to guide further work.

**Design assets.** We used ChatGPT to generate the Recapp logo and some graphics, and manually modified some of the results. The school's logo is a separate asset belonging to the school.

**Team contributions.** Leonardo coordinated the team, originated the project idea and contributed to development. Luca contributed to development, beta testing and finding and checking bugs. Oleksii contributed to development and beta testing and created the [demo video](https://youtu.be/vZPQf7frLNk). We worked with AI assistance; these roles do not imply that all code was written manually.

**Inside the application.** The optional Featherless integration extracts draft items from submitted text or screenshots, using class subjects and calendar context. Uploaded images are re-encoded to remove metadata, but that does not remove personal information visible in the image or typed into the text. Students must choose appropriate material to submit. The AI does not publish recaps: a student reviews the drafts. The offline parser and simulated image results are distinct from live AI inference. Listen uses browser speech synthesis, not generative AI.

The published demo is [on YouTube](https://youtu.be/vZPQf7frLNk). Oleksii made it with Claude Opus 5.5, using Remotion as a skill. Claude generated the voice and the music. The app images are real screens from the live site.

## Team

Three fourth-year Computer Science students at ITI G. Marconi, Verona, Italy:

| Member | Contribution | GitHub |
| --- | --- | --- |
| Leonardo Bassanello | Team coordinator, project originator, developer | [xFurti](https://github.com/xFurti) |
| Luca Cremonese | Developer, beta tester, bug testing | [PiEnneGi](https://github.com/PiEnneGi) |
| Oleksii Holovan | Developer, beta tester, video creator | [Oleksi-Holovan](https://github.com/Oleksi-Holovan) |

## Credits and project status

Our computer science teacher encouraged the discussion with our headteacher and confirmed that we could display the school's logo in this student project. This does not mean the school has adopted Recapp. The school logo is excluded from the code's MIT license; see [credits.md](credits.md). Recapp began as a new project for this competition and uses the external libraries and tools listed above.
