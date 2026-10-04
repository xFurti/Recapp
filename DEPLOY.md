# Deploy (fase F5)

Checklist per mettere online Recapp su `https://bassaleo.xyz`. Le chiavi vanno **solo** nel file
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
   La stessa `RENDER_API_KEY` serve anche all'avviso "aggiornamento in corso / nuova versione": il
   server legge lo stato dei deploy del servizio (`RENDER_SERVICE_ID` e `RENDER_GIT_COMMIT` li imposta
   Render da solo) e al browser manda solo la versione e un id anonimo del deploy in preparazione,
   tramite `/api/version`. Senza chiave l'avviso "nuova versione" funziona lo stesso, manca solo
   quello di preparazione.
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

## 6. Domini

Il servizio in dashboard si chiama `recapp`. Lo slug e l'indirizzo Render restano `ieri.onrender.com`. Non cancellare i domini già verificati quando ne aggiungi un altro.

All'ultimo minuto `tryrecapp.xyz` ha dato problemi di verifica. Per stabilità e affidabilità il sito pubblico resta `bassaleo.xyz` (`PUBLIC_URL`). tryrecapp può restare agganciato allo stesso servizio, ma non è l'indirizzo da comunicare.

1. Render → servizio → Settings → Custom Domains, tutti insieme:
   - `bassaleo.xyz` e `www.bassaleo.xyz` (indirizzo pubblico, `PUBLIC_URL`)
   - `tryrecapp.xyz` e `www.tryrecapp.xyz` (tenuto accanto; non sostituisce bassaleo)
2. `EXTRA_HOSTS=tryrecapp.xyz,www.tryrecapp.xyz` è già nel servizio: le scritture API da quel sito non ricevono 403. Gli inviti generati restano su `https://bassaleo.xyz`.
3. DNS di ciascun dominio verso lo stesso servizio (`A` sull'apex all'IP indicato da Render, `CNAME` di `www` verso `ieri.onrender.com`). Togli i record `AAAA` e il parcheggio del registrar.
4. La verifica e il certificato HTTPS possono richiedere da pochi minuti a qualche ora. Il sito da usare è bassaleo, anche su `https://ieri.onrender.com`.

## 7. Verifica finale (STOP 5)

- [ ] `https://bassaleo.xyz/api/healthz` risponde `{"ok": true, "env": "prod", "ocr": "featherless", "runner": "render"}`
- [ ] "Prova la demo" funziona
- [ ] Primo accesso del rappresentante 4BI con l'invito, poi aggiunta di 2 compagni
- [ ] Una giornata vera pubblicata, con un ritaglio letto dall'AI
- [ ] Area scuola: si vedono 4AI, 4BI e DEMO
