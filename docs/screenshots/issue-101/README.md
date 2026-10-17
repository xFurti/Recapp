# Issue #101 — classifica e podio

Le acquisizioni e le verifiche della revisione finale sono in [refined/README.md](refined/README.md). Le immagini qui sotto documentano la prima iterazione a `d6f978b`.

Catture dell'applicazione reale in Chromium con risposte HTTP simulate dalla fixture di `web/tests/contributions.spec.ts`. Le identità e i conteggi sono dati di prova. Screenshot e video non verificano il backend: il cambiamento riguarda esclusivamente la presentazione della classifica.

## Prima e dopo

La base è `7f32feb295f18da3ebf9fb1159b81fbbb6eb432b` (`main`, PR #100 inclusa). Le immagini `before-*` provengono dalla base originale, prima delle modifiche. Le immagini `after-*` e `ranking-*` provengono dalla build di produzione finale, servita con Vite preview.

Le coppie conservano dati, lingua, tema e viewport: Luca ha 4 Grazie, Leonardo-B 1, Andrei e Cristiano 0. Gli ultimi due condividono il terzo posto nella lista, senza un gradino a zero Grazie. Movimento ridotto fissa i valori finali nelle immagini.

| File | Vista |
| --- | --- |
| `before-desktop-dark.png` / `after-desktop-dark.png` | 1280×844, italiano, scuro, pagina completa. |
| `before-phone-light.png` / `after-phone-light.png` | 390×844, italiano, chiaro, pagina completa. |
| `before-small-phone-dark.png` / `after-small-phone-dark.png` | 320×844, inglese, scuro, pagina completa. |
| `ranking-desktop-dark.png` | Viewport desktop effettiva dopo lo scorrimento alla classifica. |
| `ranking-phone-light.png` | Viewport telefono effettiva con podio, classifica e barra inferiore. |
| `ranking-small-phone-dark.png` | Viewport 320 px in inglese e scuro. |

Le catture a pagina completa mantengono la barra mobile nella posizione della viewport iniziale. Le immagini `ranking-*` mostrano la posizione reale della barra nella viewport dopo lo scorrimento.

La riga numerica isolata non si riproduceva in queste prime catture con valori a una cifra. Il confronto finale in produzione con statistiche a più cifre ne ha poi confermato la causa e verificato la correzione; vedere il registro in `redesign/`. Il restyle sostituisce le regole posizionali del podio con classi dedicate per identità, Grazie e statistiche; le nuove schede non mostrano righe numeriche fuori posto. I test di leggibilità verificano anche contatori e testi visibili delle statistiche, prima esclusi dai controlli geometrici perché racchiusi in `aria-hidden`.

## Movimento

`docs/media/issue-101/podium-motion.mp4` e la GIF corrispondente mostrano la build finale a 1280×1100, in italiano e tema scuro, con movimento normale: ingresso a gradini, corona, aggiornamento della classifica che porta Andrei sul podio e Leonardo-B al terzo posto, salto alla propria posizione. L'aggiornamento è una nuova risposta della fixture HTTP, non una transazione reale di Grazie. Nessuna eccezione JavaScript durante la registrazione.

I media usano le cartelle previste dal repository e sono incorporati nella PR con URL fissati al commit.
