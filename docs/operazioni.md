# Operazioni (produzione)

## Ambienti

| Ambiente | Indirizzo | Database | OCR |
| --- | --- | --- | --- |
| Locale | http://localhost:5173 | SQLite `ieri.db` (consigliato) | parser a regole o Featherless |
| Produzione | https://bassaleo.xyz (anche https://tryrecapp.xyz quando il DNS è verificato) | Neon Postgres | Featherless via Render Workflows `recap-ai` |

Per lavorare in locale **senza toccare i dati veri**, nel `.env` commentate `DATABASE_URL`
(`#DATABASE_URL=...`): l'app torna su SQLite.

## Come arriva una modifica online

`git push` sul branch `main` → Render ricostruisce l'immagine Docker (3-5 minuti) → controlla
`/api/healthz` → sposta il traffico sulla nuova versione. Durante la build resta online la
versione precedente, quindi chi usa il sito non vede interruzioni.

### Regole durante la beta

1. Ogni modifica si prova prima in locale e passa i test (`pytest`).
2. **Il push lo facciamo solo dopo il vostro "ok, pubblica"**, preferibilmente in orari con poca
   gente sul sito (non durante la compilazione serale dei verbalisti, 16:30-19:00).
3. Una giornata in scrittura non si perde con un deploy: la bozza è già salvata sul server; al
   massimo un salvataggio automatico in corso va ripetuto (l'editor lo segnala).
4. Modifiche al **modello dati** (nuove colonne) vanno gestite a parte: `create_all` crea le
   tabelle nuove ma **non aggiunge colonne** a tabelle esistenti. In quel caso serve uno script di
   migrazione da lanciare su Neon prima del deploy.

### Tornare indietro

Render → servizio `ieri` → **Events** → deploy precedente → **Rollback**. Oppure `git revert` del
commit e push.

## Log e controlli

- Stato: `https://bassaleo.xyz/api/healthz` deve rispondere `{"ok": true, "env": "prod",
  "ocr": "featherless", "runner": "render"}`.
- Errori del sito: Render → `ieri` → **Logs**.
- Letture AI: Render → `recap-ai` → **Runs** (ogni lettura è un run con input, durata ed esito).

## Inviti e accessi

- Al primo avvio i log mostrano codice classe e invito admin di 4AI e 4BI, **una volta sola**.
- Invito perso o PIN dimenticato dell'admin: Area scuola → apri la classe → Classe →
  Partecipanti → menu del nick → **Nuovo invito**.
- Credenziali owner: si cambiano nelle Environment di Render (`OWNER_PASSWORD`); al riavvio
  la password viene aggiornata e le sessioni owner vecchie scadono.

## Classe DEMO

Si rigenera da sola una volta al giorno (alla prima apertura). Se qualcuno la riempie di prove,
si rigenera comunque il giorno dopo; per farlo subito serve `python -m api.seed --reset-demo`
con il `DATABASE_URL` di produzione.

## Fine anno scolastico

Da fare a giugno, d'accordo con la scuola: esportare se serve, poi cancellare i contenuti delle
classi (giornate, elementi, ritagli, letture). Oggi è un'operazione manuale sul database.
