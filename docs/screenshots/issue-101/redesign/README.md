# Carte premio e traguardo personale — issue #101

La versione finale alleggerita è documentata in [../refined/README.md](../refined/README.md). Questa cartella conserva il confronto della revisione a `1bd35ec`.

Catture dell'interfaccia reale in Chromium con dati di prova e risposte HTTP simulate da `web/tests/contributions.spec.ts`. Nessun dato di classe reale e nessuna scrittura sul backend. Sia il prima sia il dopo usano build di produzione e il carattere Inter distribuito con l'app.

## Confronto

La base `d6f978bdb91670adaf959fb34777a9448532037a` è la versione iniziale della PR #102. I file `before-*` sono stati acquisiti dalla sua build in un worktree separato; `after-*`, `stage-*` e `personal-milestone.png` provengono dalla build finale di questa revisione. Movimento ridotto fissa i numeri e il layout nelle immagini.

Dati identici: Ada 65 Grazie, Leo (utente corrente) 43, Nora 31, Milo 18, Sofia 12, Tommaso 0. Le statistiche includono numeri a più cifre: 12/24 per Ada, 8/17 per Leo, 7/12 per Nora.

| File | Vista |
| --- | --- |
| `before-desktop-dark.png` / `after-desktop-dark.png` | 1280×844, italiano, scuro, pagina completa. |
| `before-desktop-light.png` / `after-desktop-light.png` | 1280×844, italiano, chiaro, pagina completa. |
| `before-phone-light.png` / `after-phone-light.png` | 390×844, italiano, chiaro, pagina completa. |
| `before-small-phone-dark.png` / `after-small-phone-dark.png` | 320×844, inglese, scuro, pagina completa. |
| `stage-*` | Le stesse viewport dopo lo scorrimento alla scena del podio, con la barra mobile nella posizione reale. |
| `personal-milestone.png` | Scheda personale: 22 Grazie per condividere il primo posto, con avanzamento 43 su 65. |
| `counter-before-production.png` | Cattura diagnostica della nuova scena prima della correzione dei contatori: evidenzia le cifre isolate con il carattere di produzione. |

Nelle catture a pagina completa la barra mobile rimane alla posizione della viewport iniziale. Le immagini `stage-*` rappresentano la viewport effettiva.

## Correzione della riga numerica

Con il carattere di produzione, lo spazio stimato in `ch` faceva andare su due righe alcuni numeri delle statistiche. Il confronto della base rileva 12, 24, 17 e 12 spezzati in tutte e quattro le viste; la build finale non rileva alcun numero spezzato. Il componente ora misura le cifre finali effettive con uno pseudo-elemento invisibile e sovrappone il valore animato senza ritorno a capo. Il testo accessibile contiene sempre il numero finale. Due test specifici controllano numeri fino a quattro cifre, con il carattere caricato, a 320 e 1280 px.

## Movimento

`docs/media/issue-101/redesign/award-cards.mp4` e la relativa GIF mostrano la build finale in italiano e scuro a 1280×960: ingresso a gradini e corona, riflessi e inclinazione su tutte e tre le carte, avanzamento di Leo da 43 a 70 Grazie e dal secondo al primo posto, salto alla propria posizione. Il cambio dei conteggi è una nuova risposta della fixture HTTP. Nessuna eccezione JavaScript durante la registrazione.

La luce e l'inclinazione rispondono al puntatore mouse senza un ciclo continuo o render React. I dispositivi touch conservano le carte statiche. Il movimento ridotto disattiva ingresso, scintille, inclinazione e transizioni della barra personale. Le stelle animate si fermano dopo due cicli.

## Spunti visivi

Implementazione originale in React e CSS, senza nuove dipendenze. Riferimenti consultati: [Uiverse Cards](https://uiverse.io/cards), [Profile Card](https://reactbits.dev/components/profile-card), [Spotlight Card](https://reactbits.dev/components/spotlight-card) e [Star Border](https://reactbits.dev/animations/star-border) di React Bits.
