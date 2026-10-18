# Tipografia dell’app

Inter Variable resta il carattere di Recapp. La scala in `web/src/typography.css`
usa `rem` (qui 1rem = 16 px), pesi e interlinee espliciti. Le utility `type-*`
si applicano ai ruoli del testo; non cambiano i colori, le superfici, la larghezza
delle pagine o la disposizione delle griglie.

| Utility | Dimensione | Peso | Interlinea | Uso |
| --- | --- | --- | --- | --- |
| `type-page-title` | 26 px telefono, 32 px da 48rem | 700 | 1,2 | Titolo della vista, data, titolo dell’editor |
| `type-section-title` | 18 px | 600 | 1,4 | Sezioni, materia negli appunti, titolo dei dialoghi |
| `type-item-title` | 16 px | 600 | 1,45 | Titolo di una scadenza o di una riga |
| `type-prose` | 16 px | 400 | 1,6 | Appunti, note, laboratorio, risposte; massimo 68ch |
| `type-meta` | 14 px | 400 | 1,5 | Autore, orario, aula, suggerimenti e stato del salvataggio |
| `type-label` | 14 px | 500 | 1,5 | Etichette di campo, contesto della pagina, filtri |
| `type-badge` | 13 px | 500 | 1,4 | Tipo, stato compatto, navigazione mobile |
| `type-action` | 15 px | 500 | 1,4 | Pulsanti condivisi e comandi di ascolto |

I campi condivisi usano `text-prose` (16 px / 1,6); i campi degli appunti
aggiungono `type-prose` per la misura di lettura. I titoli non dipendono dal
colore per distinguersi: hanno dimensione e peso diversi. Le intestazioni delle
viste di lettura e dell’editor sono in maiuscolo/minuscolo; i codici delle materie
e le sigle LAB conservano la loro grafia. I nomi interpolati nei messaggi usano
peso 500, senza competere con i titoli.

## Riutilizzo e testo lungo

- Usare il ruolo appropriato evitando di aggiungere `text-*`, `font-*`,
  `uppercase` o interlinee in conflitto. I token `--text-*` sono disponibili anche
  alle utility Tailwind; `type-prose` aggiunge la misura di lettura e l’andata a capo.
- Titoli, appunti e metadati vanno a capo anche per stringhe senza spazi
  (`overflow-wrap: anywhere`); non usare ellissi per informazioni necessarie.
- Nei contenitori flex lasciare restringere il testo (`min-w-0`), preservando
  le icone. Pulsanti e filtri hanno un’altezza minima, che può crescere. Gli stati della
  lezione passano a una colonna sotto 18rem e separano icona/indicatore dal
  testo sotto 10rem, evitando etichette ridotte a una lettera per riga.
  L’altezza effettiva della navigazione determina la distanza dei comandi fissi.
  Quando nell’editor rimangono al massimo 12rem di larghezza (ad esempio a
  320/390 px con testo al 200%), la barra di salvataggio torna nel flusso della
  pagina: le barre fisse non devono occupare tutta l’area disponibile per leggere.
- Gli appunti nell’editor sono textarea, ridimensionabili e con dimensionamento
  nativo al contenuto dove il browser supporta `field-sizing: content`. Negli altri
  browser resta disponibile lo scorrimento e il ridimensionamento della textarea.
  Invio aggiunge un punto; Backspace su un punto vuoto lo rimuove, come prima.
- Il limite 68ch riguarda il testo da leggere, non il contenitore della pagina:
  le modifiche a larghezze e griglie rimangono nel perimetro di #132.

## Verifica di #129

Base: `6cc6421d909ce58fc4fd887566f326e238573cb1`. #96 e PR #99 risultavano aperte
e il restyling di Oggi non era incluso nella base. Questa modifica non importa
bento, timeline o riordino delle scadenze; dopo il merge di #99 i nuovi componenti
potranno adottare gli stessi ruoli. `ui`, `day`, `items`, `shell` e le pagine sono
possibili punti di sovrapposizione con #128 e #132: preservare i loro cambiamenti a
superfici, metadati, larghezze e griglie mentre si portano i ruoli tipografici.
I flussi di menu e conferma e il calcolo dei fusi di #125 rimangono separati.

```bash
cd web
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test --config playwright.typography.config.ts
# Per rigenerare il dopo solo dopo le modifiche definitive:
TYPOGRAPHY_CAPTURE=after npx playwright test --config playwright.typography.config.ts
```

La suite usa le pagine React vere, dentro la shell, con risposte HTTP simulate
per rendere confrontabili date, contenuti e nomi. Non verifica il backend né
sostituisce prove su dispositivi fisici. Copre Oggi, materia, In arrivo ed editor,
320/390/1440 px, italiano/inglese, chiaro/scuro, stringhe lunghe e senza spazi,
testo al 200% tramite dimensione radice raddoppiata (non semplice ingrandimento
dell’immagine), focus da tastiera, movimento ridotto e salvataggio degli appunti.

[La galleria prima/dopo](screenshots/issue-129/README.md) contiene le schermate
reali del browser. Il prima è stato acquisito sulla base senza modifiche al codice
applicativo; il dopo usa gli stessi dati, percorsi, viewport, lingua e tema.
