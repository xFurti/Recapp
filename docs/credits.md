# Credits and AI use

## Team

Recapp was started from scratch for the CSC Back-to-School Hackathon by three fourth-year Computer Science students at ITI G. Marconi, Verona, Italy. The team formed on September 20, 2026.

| Member | Role | Account |
| --- | --- | --- |
| Leonardo Bassanello | Team coordinator, project originator, developer | [xFurti](https://github.com/xFurti) |
| Luca Cremonese | Developer, beta tester, bug testing | [PiEnneGi](https://github.com/PiEnneGi) |
| Oleksii Holovan | Developer, beta tester, video creator | [Oleksi-Holovan](https://github.com/Oleksi-Holovan) |

These roles describe the team's contributions in an AI-assisted workflow. Commit authorship alone does not establish who manually wrote every line or which assistant was used in every session.

## AI-assisted development and design

- **Cursor:** initial planning and implementation, subsequent features and bug fixes.
- **Claude:** assistance with development, additions and bug fixes.
- **Codex:** assistance with implementation, debugging, tests, reviews and documentation; submission copy was prepared from the team's own account.
- **ChatGPT:** generation of the Recapp logo and some graphics; the team manually edited some results.

The team supplied the initial ideas, product direction and account of its experience, and tested the application. AI contributed substantially to the implementation. Video production credits are pending the final video; no particular video tool is claimed here.

## AI inside Recapp

Featherless is an optional extraction provider for text and cropped screenshots. Models are configured through environment variables; Render Workflows is an optional task runner. Extracted items require human review before publication. The local rule-based parser and simulated image output are not live model inference. Browser speech synthesis powers Listen.

See [the extraction documentation](ai-e-ocr.md) and [configuration](../.env.example). Deployment-specific model selection must be verified against the running environment before claiming a particular model in a demo or submission.

## School logo and school involvement

The ITI G. Marconi Verona logo belongs to the school and is excluded from the [MIT license](../LICENSE) covering the project's code. That license does not grant permission to reuse the school logo.

The team reports that its computer science teacher confirmed that it could display the logo in this student project. The logo's presence does not indicate school adoption or an approved classroom pilot. The headteacher has heard the idea; a presentation of the developed project and a possible pilot are future steps to agree with the school.

The school logo is distinct from the AI-assisted Recapp logo.

## Libraries and other resources

The frontend dependencies and versions are recorded in [package.json](../web/package.json) and its lockfile; backend dependencies are recorded in [requirements.txt](../api/requirements.txt). The project uses resources including Lucide icons and the Inter typeface. Third-party resources retain their own applicable licenses; the project's MIT license does not replace them.

Additional graphics, music, voices and footage used in the final video should be credited here when the video is ready. Review the rights for those specific assets before redistributing them.
