# Classifica con finiture discrete — issue #101

Catture reali di Chromium dalla build di produzione, con Inter e risposte HTTP simulate dalla fixture di `web/tests/contributions.spec.ts`. Identità e conteggi sono dati di prova; nessuna scrittura sul backend.

Il prima è il commit `1bd35ec0b6b6374b19dd21c98bd6bea711f1c420`: i file `before-*` sono copie delle relative acquisizioni di produzione in `redesign/`. Il dopo usa la build finale alleggerita, con gli stessi dati, lingua, tema e viewport.

Ada ha 65 Grazie, Leo (utente corrente) 43, Nora 31, Milo 18, Sofia 12 e Tommaso 0. La scheda personale indica 22 Grazie per condividere il primo posto. Movimento ridotto fissa numeri e layout nelle immagini.

| File | Vista |
| --- | --- |
| `before-desktop-dark.png` / `after-desktop-dark.png` | 1280×844, italiano, scuro, pagina completa. |
| `before-desktop-light.png` / `after-desktop-light.png` | 1280×844, italiano, chiaro, pagina completa. |
| `before-phone-light.png` / `after-phone-light.png` | 390×844, italiano, chiaro, pagina completa. |
| `before-small-phone-dark.png` / `after-small-phone-dark.png` | 320×844, inglese, scuro, pagina completa. |
| `stage-*` | Viewport effettiva dopo lo scorrimento al podio. |
| `personal-milestone.png` | Scheda personale con avanzamento 43 su 65. |

Le catture a pagina completa mantengono la barra mobile alla posizione della viewport iniziale. I file `stage-*` mostrano la posizione reale della barra.

Il risultato segue i colori del tema, con leggere tinte oro/argento/bronzo, una corona discreta, avatar con bordo semplice e statistiche ordinate. La composizione è più compatta e conserva il traguardo personale. Il contatore continua a misurare le cifre finali effettive: nessun numero spezzato nelle quattro viste.

`docs/media/issue-101/refined/podium.mp4` e la relativa GIF mostrano la build finale a 1280×960 in italiano e scuro: breve ingresso del podio, aggiornamento della fixture che porta Leo da 43 a 70 Grazie e dal secondo al primo posto, salto alla propria posizione. Nessuna eccezione JavaScript nella registrazione. Movimento ridotto disattiva ingresso e transizioni.
