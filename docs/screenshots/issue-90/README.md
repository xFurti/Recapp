# Issue #90 — podio e animazioni

Acquisizioni reali con Chromium dalla build di produzione, FastAPI locale e un database SQLite demo isolato. Nessuna risposta HTTP simulata nelle immagini o nella registrazione. Solo identità fittizie. I test browser usano invece risposte HTTP deterministiche per coprire i casi limite.

## Confronto

La base originale è `d588f26e7319e4dec63a6f00169422872b4e70b3` (main, PR #88 inclusa). Le coppie `before-*` / `after-*` e `before-streak-*` / `streak-*` conservano contenuti, viewport, lingua e tema. I database locali sono stati inizializzati separatamente: i nickname e i conteggi coincidono, mentre i colori degli avatar dipendono dagli id locali e possono differire. Il prima proviene dalla build effettiva della base.

| File | Vista |
| --- | --- |
| `before-desktop.png`, `after-desktop.png` | 1280×960, italiano, chiaro; parità al secondo posto, nessun terzo gradino fittizio. |
| `before-phone.png`, `after-phone.png` | 390×960, inglese, scuro; pagina completa. |
| `before-small-phone.png`, `after-small-phone.png` | 320×960, italiano, chiaro; pagina completa. |
| `before-streak-*`, `streak-*` | Stesse tre viewport nella pagina Classe; scheda compatta sopra Partecipanti, Turni e Orario. |
| `three-steps-desktop.png` | Tre posizioni distinte dopo un Grazie reale a un elemento demo di marta. |
| `podium-phone.png` | 390×844, inglese, scuro; accesso come luca e focus sulla propria scheda al primo posto. |
| `new-record-desktop.png` | Pubblicazione puntuale della giornata demo: serie e record passano da 5 a 6, con scintille confinate nella scheda. |

Le immagini a pagina completa includono la barra mobile fissata al fondo della viewport iniziale; la pagina continua a scorrere sotto di essa. `podium-phone.png` mostra la viewport effettiva dopo il salto alla propria posizione, con la barra al bordo inferiore.

## Registrazione

`docs/media/issue-90/contributions-motion.mp4` (10 secondi) e la GIF corrispondente mostrano ingresso della scheda Classe e dei contatori, apertura di Contributi, aggiornamento del podio dopo un Grazie, salto alla propria posizione, pubblicazione e record, quindi reload senza ripetere la celebrazione. Grazie e pubblicazione sono richieste alla vera API locale; le immagini mostrano gli aggiornamenti della vera applicazione. Nessuna eccezione JavaScript nelle acquisizioni.

Le scintille richiedono una nuova pubblicazione puntuale e un record maggiore del massimo già osservato per classe e periodo. Il primo caricamento senza osservazioni precedenti stabilisce la base; refetch, navigazione, reload e un record ricalcolato che ritorna al massimo precedente non ripetono l'effetto. La memoria locale ha un ripiego in memoria se lo storage non è disponibile. I contatori espongono subito il testo finale agli screen reader e non usano annunci live; movimento ridotto disattiva gli effetti e visualizza subito i valori finali.

Il browser GitHub disponibile nella sessione non ha un account connesso, quindi l'upload diretto degli allegati non è disponibile. I media usano le cartelle già previste dal repository e vengono incorporati nella PR con link fissati al commit, senza scadenza.
