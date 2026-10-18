# Issue #139 — laboratori, link e foto degli appunti

Le catture `before-*` provengono dalla base originale `6cc6421d909ce58fc4fd887566f326e238573cb1`, prima delle modifiche al codice dell’app. Le catture `after-*` mostrano il risultato finale: superficie e tipografia delle note, link con dominio e indirizzo completo espandibile, miniature uniformi e visualizzatore con contatore, precedente/successiva e frecce da tastiera. Sono state acquisite dopo le ultime modifiche visibili. Le catture intermedie della bozza sono state sostituite da quelle finali.

Sono screenshot reali di Chromium con Vite, componenti React, CSS, router e traduzioni dell’app. Il punto di ingresso `web/tests/lab-presentation.html` monta DayCardView, SubjectPage ed Editor dentro AppShell. Le risposte HTTP sono simulate con dati sintetici; anche le immagini SVG servite agli URL degli allegati sono appunti sintetici in proporzioni verticale, panoramica e quadrata. Non vengono usati dati privati, account reali o servizi di produzione. Queste prove non verificano un backend live o un deploy; i test API esistenti verificano separatamente il comportamento dei laboratori e la protezione degli allegati, senza risolvere o estendere #103/#115.

## Catture

Ogni confronto della giornata usa gli stessi contenuti, schermata, viewport, lingua e tema. Sono presenti 12 immagini prima e 12 dopo: 1280 × 960, 390 × 960 e 320 × 960, italiano/inglese, tema chiaro/scuro. Le catture usano movimento ridotto. I testi degli appunti sono contenuti utente e rimangono in italiano anche nell’interfaccia inglese; le intestazioni legacy sono tradotte.

| Altri file | Contenuto |
| --- | --- |
| `after-subject-*` | Materia, a 1280/390/320 px |
| `after-editor-*` | Editor, a 1280/390/320 px |
| `after-preview-*` | Anteprima dell’editor, a 1280/390/320 px |
| `after-viewer-*` | Foto panoramica 2 di 3, con entrambi i comandi di navigazione, a 1280/390/320 px |
| `after-address-*` | Indirizzo completo espanso a 390 px IT chiaro e 320 px EN scuro |
| `viewer-navigation.webm`, `viewer-navigation.gif` | Registrazione reale di apertura, navigazione con pulsante e tastiera tra tre proporzioni e chiusura con ripristino del focus; telefono 390 × 960, IT scuro |

Le viste aggiuntive a 1280 px sono in italiano chiaro, quelle a 390 px in italiano scuro, quelle a 320 px in inglese scuro. In totale: 38 screenshot, una registrazione WebM e una GIF della stessa registrazione. La GIF omette i primi 0,4 secondi di avvio ed è ridimensionata a 320 px e 6 fotogrammi al secondo; le interazioni sono quelle reali dell’app.

## Riproduzione e verifiche

```sh
cd web
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --config playwright.lab-presentation.capture.ts --workers=3
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --config playwright.lab-presentation.config.ts --workers=3
```

Il primo comando rigenera solo le catture `after-*` e il WebM, senza toccare il prima originale. La GIF è ricavata dal WebM con FFmpeg. Il secondo esegue 55 controlli di regressione: include giornata, materia, editor e anteprima, testo al 200%, note lunghe e multilinea, dati legacy, link e URL completi, tastiera e focus, proporzioni delle immagini, stati di caricamento/errore/riprova, salvataggio, riapertura e pubblicazione. I test API sui laboratori e sugli allegati vengono eseguiti separatamente.

Limiti: con il nome materia volutamente lungo della fixture, SubjectMenu esce dalla pagina a 320 px in italiano già sulla base; il componente non è modificato. I blocchi coinvolti dalla issue restano nei propri limiti anche al 200%. WebKit non può avviarsi su questo host perché manca `libicudata.so.74`; la verifica eseguita è su Chromium, non su un iPhone fisico.

I media seguono il sistema già adottato dal repository: file versionati in `docs/screenshots/`, incorporati nella PR con URL fissati al commit e senza scadenza.
