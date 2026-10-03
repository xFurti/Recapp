# FAQ e creatori

La pagina pubblica `/faq` è raggiungibile dalla home accanto a Privacy. Non richiede una sessione. `About.tsx` compone `FaqAccordion` e `CreatorSlideshow`; non introduce dipendenze runtime.

## Contenuti da revisionare

Ordine e collegamenti delle FAQ sono in `web/src/content/about.ts`; domande e risposte in `about.faq` nei file `web/src/i18n/it.json` e `en.json`.

Le risposte sono state confrontate con README, Join, Landing, `api/services.py`, `api/schedule.py`, autenticazione e gestione delle immagini. Descrivono riepiloghi, demo dedicata al browser, inviti e PIN, rotazione, passaggio del turno, presa del turno alle 18:00 e importazione in bozze. Nessuna risposta dichiara accesso automatico ai servizi della scuola.

Prima della pubblicazione il team deve approvare i testi, come richiesto dall’issue #18. L’apertura della PR serve alla revisione e non costituisce approvazione dei contenuti.

## Profili

L’array `creators` in `web/src/content/about.ts` contiene i nickname forniti dal team: Leo, Luca e Alex, tutti con ruolo “Developer e creatore” (inglese: “Developer and creator”). Biografie, foto e link personali saranno aggiunti dal team in seguito. Finché la biografia è vuota non viene mostrato un paragrafo, e in assenza di foto compare la grafica con iniziali. Non inventare le informazioni personali mancanti.

Ogni profilo usa `id`, `name`, `role: { it, en }`, `bio: { it, en }`, una foto opzionale `{ src, alt: { it, en } }` e link opzionali `{ label, href }`. Usare immagini ridimensionate e compresse (preferibilmente WebP), con ritaglio quadrato. Il componente riserva lo spazio dell’immagine e usa una grafica con iniziali quando la foto manca o non si carica.

La presentazione avanza solo manualmente. Selettori, precedente/successivo, Tab, Invio, Spazio, frecce sinistra/destra, Home ed End funzionano anche senza animazioni. I profili inattivi e le risposte chiuse sono esclusi dalla navigazione e dagli screen reader. Tutti i profili condividono una cella della griglia, che riserva lo spazio della biografia più lunga.

## Verifica

```sh
cd web
npm ci
npx playwright install chromium ffmpeg
npm run build
npm run lint
npm run test:e2e
```

Per usare Chromium già installato: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.

I test navigano nell’app reale per home, URL diretto, FAQ, Privacy, lingue e temi; simulano solo risposte API non pertinenti alla pagina. Il componente dei creatori viene testato separatamente con dati sintetici esplicitamente etichettati `Fixture`, mai importati dalla produzione, anche con foto mancante e biografia lunga.

Screenshot desktop/mobile nei due temi e registrazioni vengono generati in `web/test-results`, ignorato da Git. Allegarli direttamente alla PR: non aggiungerli alle cartelle del repository.
