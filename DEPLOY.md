# Deploy (fase F5)

Checklist per mettere online Ieri su `https://bassaleo.xyz`. Le chiavi vanno **solo** nel file
`.env` (in locale) e nelle Environment Variables di Render: mai nel repository e mai in chat.

## 0. Prima di tutto

- [ ] Crediti Render riscattati (scadenza sponsor: 1 ottobre).
- [ ] Chi usa Render ha almeno 16 anni. Per Featherless, per i minorenni, serve il consenso di un genitore ai termini d'uso.

## 1. Repository GitHub

1. Crea il repo pubblico, es. `Recapp`, **senza** README (c'è già).
2. In locale:
   ```bash
   git add -A
   git commit -m "Recapp MVP"
   git remote add origin git@github.com:<utente>/Recapp.git
   git push -u origin main
   ```
3. Controlla su GitHub che non ci siano `.env`, `.dev_secret` o file `*.db`.

## 2. Database Neon (gratis)

1. https://neon.tech → New project `ieri`, regione Europa (Frankfurt).
2. Dashboard → Connection string → copia quella con `sslmode=require`.
3. Su Render sarà `DATABASE_URL`. Va bene anche nel formato `postgresql://...`: l'app lo converte da sola.

## 3. Featherless

1. https://featherless.ai → Account → API Keys → crea una chiave.
2. Nel `.env` locale: `FEATHERLESS_API_KEY=...` e `OCR_PROVIDER=featherless`.
3. Scegli i modelli (lo facciamo insieme): uno **vision** per i ritagli (`FEATHERLESS_MODEL`)
   e uno di testo per le righe incollate (`FEATHERLESS_TEXT_MODEL`, opzionale: senza, si usa quello vision).
4. Prova in locale con un ritaglio vero di ClasseViva/Classroom **senza voti né nomi**.

## 4. Render: Web Service (sito + API)

1. Render → New → Blueprint → collega il repo: legge `render.yaml` e crea il servizio `ieri`
   (Docker, piano Starter, Frankfurt, health check `/api/healthz`).
2. Compila le variabili marcate `sync: false`:
   | Variabile | Valore |
   | --- | --- |
   | `DATABASE_URL` | stringa di Neon |
   | `OWNER_USERNAME` / `OWNER_PASSWORD` | account dell'Area scuola (password lunga) |
   | `FEATHERLESS_API_KEY`, `FEATHERLESS_MODEL`, `FEATHERLESS_TEXT_MODEL` | da Featherless |
   | `RENDER_API_KEY` | Account Settings → API Keys |
   | `RENDER_WORKFLOW_TASK` | slug del task: da noi `recap-ai/extract_items` (vedi punto 5) |
   `SECRET_KEY` viene generata da Render.
3. Al primo avvio, nei **Logs** del servizio compaiono i codici classe di 4AI e 4BI e un invito
   admin per ciascuna (mostrati una sola volta). Salvali in un posto sicuro e dalli ai rappresentanti.
   Se si perdono: Area scuola → rigenera l'invito.

## 5. Render Workflows (OCR)

1. Render → New → **Workflow** → stesso repo (da noi si chiama `recap-ai`). Root Directory vuota.
2. Build command: `pip install -r api/requirements-workflow.txt`
3. Start command: `python -m api.workflow` (con `-m`: `python api/workflow.py` non funziona per
   l'import relativo e dà "Could not detect tasks").
4. Environment: `FEATHERLESS_API_KEY`, `FEATHERLESS_MODEL`, `FEATHERLESS_TEXT_MODEL`.
5. Dopo il deploy, il task `extract_items` compare nella dashboard con il suo slug
   (`recap-ai/extract_items`): copialo in `RENDER_WORKFLOW_TASK` del Web Service.
6. Se Workflows dà problemi: metti `TASK_RUNNER=inline` nel Web Service. L'OCR gira dentro
   l'app e tutto funziona uguale; si perde solo l'idoneità al premio Render.

## 6. Dominio bassaleo.xyz (gen.xyz)

1. Render → servizio `ieri` → Settings → Custom Domains: `bassaleo.xyz` e `www.bassaleo.xyz`
   (già in `render.yaml`).
2. Pannello DNS di gen.xyz:
   - record `A` per `@` verso l'IP indicato da Render (oggi `216.24.57.1`, controlla in dashboard);
   - record `CNAME` per `www` verso `ieri.onrender.com` (o il nome mostrato da Render);
   - elimina i record di parcheggio predefiniti di gen.xyz.
3. Aspetta la verifica e il certificato HTTPS (da pochi minuti a qualche ora).
4. Nel frattempo il sito è raggiungibile su `https://ieri.onrender.com`: per usarlo così,
   metti temporaneamente `PUBLIC_URL=https://ieri.onrender.com`.

## 7. Verifica finale (STOP 5)

- [ ] `https://bassaleo.xyz/api/healthz` risponde `{"ok": true, "env": "prod", "ocr": "featherless", "runner": "render"}`
- [ ] "Prova la demo" funziona
- [ ] Primo accesso del rappresentante 4BI con l'invito, poi aggiunta di 2 compagni
- [ ] Una giornata vera pubblicata, con un ritaglio letto dall'AI
- [ ] Area scuola: si vedono 4AI, 4BI e DEMO
