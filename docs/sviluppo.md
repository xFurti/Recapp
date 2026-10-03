# Sviluppo

## Avvio

```bash
./scripts/dev.sh
```

Crea il virtualenv Python 3.12 con `uv`, installa le dipendenze, avvia l'API su
http://localhost:8000 (con ricarica automatica) e Vite su http://localhost:5173 (le chiamate
`/api` vengono inoltrate all'API). Swagger con tutte le route: http://localhost:8000/docs.

Accessi locali: "Prova la demo" (tutti i nick DEMO funzionano anche con PIN `123456`), Area
scuola `preside` / `demo`.

## Test

```bash
.venv/bin/python -m pytest api/tests -q
```

25 test coprono: login e blocco dopo 5 errori, inviti, permessi, rotazione con festività,
stati della giornata e presa del turno alle 18:00, pubblicazione e regola anti-vuoto, parser a
regole e validazione delle bozze, prompt dell'AI, OCR inline e via Render Workflows (simulato),
pulizia EXIF delle immagini, controllo `Origin`.

Gli stessi test girano anche su Postgres impostando `TEST_DATABASE_URL` (usare uno schema
separato, mai lo schema pubblico di produzione).

Frontend:

```bash
cd web && npx tsc -b && npx oxlint src && npm run build
```

## Aggiungere una funzione (esempio: un nuovo campo nella giornata)

1. `api/models.py`: aggiungi il campo (attenzione alla migrazione in produzione, vedi
   [operazioni.md](operazioni.md)).
2. `api/schemas.py`: aggiungilo al modello d'ingresso con i limiti di lunghezza.
3. `api/services.py`: salvalo in `save_card` e restituiscilo in `card_out`.
4. `web/src/types.ts`: aggiungi il tipo.
5. `web/src/pages/Editor.tsx` e `web/src/components/day.tsx`: modifica e visualizzazione.
6. `web/src/i18n/it.json` e `en.json`: i testi.
7. Un test in `api/tests/test_api.py`.

## Convenzioni

- Messaggi d'errore del backend in italiano, brevi, mostrati così come sono all'utente.
- Date come stringhe `YYYY-MM-DD`; giorni della settimana 0 = lunedì.
- Nessun segreto nel codice: tutto da variabili d'ambiente.
- Commenti solo per vincoli che il codice non mostra da solo.
