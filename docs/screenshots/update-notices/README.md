# Avvisi di aggiornamento

Screenshot reali della home e della pagina Oggi di Recapp eseguite con Vite e Chromium. Sono usati il router, i componenti, le traduzioni e il CSS dell'applicazione. Le risposte HTTP di versione, sessione, note di rilascio e dati della classe sono simulate per riprodurre gli stati di aggiornamento senza avviare un deploy Render o usare account reali. Le immagini non provano un deploy effettivo.

| Prefisso file | Viewport | Lingua e tema |
| --- | --- | --- |
| `desktop-dark-*` | 1440 × 960 | Italiano, scuro |
| `desktop-light-*` | 1440 × 960 | Italiano, chiaro |
| `phone-light-*` | 390 × 844 | Italiano, chiaro |
| `phone-dark-en-*` | 390 × 844 | Inglese, scuro |
| `phone-320-*` | 320 × 740 | Italiano, chiaro |
| `class-phone-dark-*` | 390 × 844 | Oggi, italiano, scuro |
| `class-desktop-light-*` | 1440 × 960 | Oggi, italiano, chiaro |

Ogni coppia mostra `preparing` e `ready`. Le catture statiche usano movimento ridotto per fissare il risultato finale. La registrazione in `docs/media/update-notices/transition.mp4` e la GIF corrispondente mostrano ingresso, animazione del logo, espansione, riflesso sul bordo e rinvio su un telefono 390 × 844 in italiano e tema scuro. Gli intervalli di preparazione del deploy sono accelerati nella registrazione; le animazioni dell'interfaccia sono quelle reali.

I test browser verificano separatamente anche AppShell, modifica dell'altezza dell'intestazione, navigazione e scorrimento, testo ingrandito, viewport bassa e il salvataggio prima del reload, con un primo tentativo fallito e un secondo riuscito. Il backend di aggiornamento ha una suite indipendente (`api/tests/test_updates.py`). Non sono stati aggiunti cambiamenti alle API o alla logica di polling.

Riferimenti visivi: [React Bits Animated Content](https://reactbits.dev/animations/animated-content), [React Bits Star Border](https://reactbits.dev/animations/star-border), [Uiverse Vista Itinerary Toast](https://uiverse.io/uiverse-astronaut/great-turtle-50). Il CSS è originale e riutilizza il logo a fogli già presente nel repository; non sono aggiunte librerie di animazione.

I media sono versionati nelle cartelle già previste dal progetto e incorporati nella PR con URL fissati al commit, senza scadenza.
