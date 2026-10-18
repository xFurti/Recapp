# Issue #139 — laboratorio e miniature (lavoro in corso)

Le catture `before-*` provengono dalla base originale `6cc6421d909ce58fc4fd887566f326e238573cb1`, prima delle modifiche al codice dell'app. Le catture `progress-*` mostrano le parti implementate sul branch dedicato: superficie delle note, tipografia, miniature e stati del visualizzatore. **Non sono ancora il risultato finale della issue**: la resa dei link e la navigazione tra immagini attendono le scelte dell'utente.

Sono screenshot reali di Chromium con Vite, componenti React, CSS, router e traduzioni dell'app. Il punto di ingresso di test `web/tests/lab-presentation.html` monta DayCardView, SubjectPage ed Editor dentro AppShell. Le risposte HTTP sono simulate con dati sintetici; anche le immagini SVG servite agli URL degli allegati sono appunti sintetici in proporzioni verticale, panoramica e quadrata. Queste prove non verificano un backend live, account reali o un deploy. Le autorizzazioni e la visibilità degli allegati sono verificate separatamente dai test API esistenti.

La schermata, il contenuto e i parametri di ciascuna coppia sono gli stessi: viewport 1280 × 960, 390 × 960 o 320 × 960; italiano/inglese; tema chiaro/scuro. Le catture usano movimento ridotto. I testi degli appunti sono contenuti utente e rimangono in italiano anche nell'interfaccia inglese; le intestazioni legacy sono tradotte.

La suite `lab-presentation.spec.ts` verifica inoltre giornata, materia ed editor, ingrandimento del testo al 200%, focus della tastiera e apertura, caricamento, errore/riprova, allegati singoli e multipli, note legacy, anteprima e rimozione degli allegati della giornata. Con il nome materia volutamente lungo della fixture, SubjectMenu esce dalla pagina a 320 px in italiano già sulla base (il componente non è modificato); i blocchi coinvolti dalla issue restano nei propri limiti. WebKit non può avviarsi su questo host: manca `libicudata.so.74`.

I media seguono il sistema già adottato dal repository: file versionati in `docs/screenshots/`, incorporabili nella PR con URL fissati al commit e senza scadenza.
