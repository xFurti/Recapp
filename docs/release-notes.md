# Note di rilascio e pagina Novità

La pagina pubblica è `/novita`; il collegamento è nella home accanto a Privacy.
Pagina e popup leggono `/api/releases`, una sola fonte bilingue. Le note sono
contenuto editoriale: spiegano il risultato per chi usa Recapp, senza messaggi
di commit, dati della classe, credenziali o dettagli interni.

## Una PR, una nota verificata

Prima del merge, aggiungere un file nuovo in `release-notes/` con un nome unico.
Usare `2026-10-13-novita.json` come esempio completo. Campi obbligatori:

| Campo | Significato |
| --- | --- |
| `id` | Identificativo stabile, ad esempio `2026.10.14.1`. Non è l'id del deploy. |
| `published_at` | Data editoriale del rilascio in UTC, formato `2026-10-14T12:00:00Z`; determina l'ordine. |
| `visibility` | `public`, oppure `internal` per “Nessuna novità da mostrare”. |
| `title` | Titolo con `it` ed `en`. |
| `summary` | Da 3 a 5 punti brevi, ciascuno con `it` ed `en`, per il popup. |
| `entries` | Note complete: `category`, `title`, `body`. |

Categorie: `feature` (Nuova funzionalità), `improvement` (Miglioramento), `fix`
(Correzione). Le categorie vuote non compaiono. `title` e `body` hanno entrambe
le lingue. La data va concordata in review; non prova l'ora del deploy.

Una nota può avere `link: {href, label: {it, en}, requires_login: true/false}`.
Sono ammessi URL HTTPS e percorsi locali: le pagine di classe continuano a
richiedere la loro normale sessione. Evitare codici di classi reali nei testi
pubblici. Un'immagine usa `image: {src: "/release-media/esempio.webp", alt: {it, en}}`:
mettere il file in `web/public/release-media/`, così viene distribuito con l'app.

Per modifiche interne, il file completo è:

```json
{
  "id": "2026.10.14.1",
  "published_at": "2026-10-14T12:00:00Z",
  "visibility": "internal",
  "reason": {
    "it": "Nessuna novità da mostrare: aggiornamento degli strumenti di sviluppo.",
    "en": "No user-facing updates: development tooling update."
  }
}
```

Il template PR richiede la nota e la verifica dei testi. L'azione **Release notes**
controlla che ogni PR aggiunga una nota nuova, che italiano e inglese siano
completi e che riepilogo, categorie e URL siano validi. Non consente di cambiare
o eliminare file dello storico. Per un nuovo aggiornamento si usa un nuovo id.
La review del team approva anche i testi: il controllo automatico non sostituisce
questa verifica. Rendere il check obbligatorio nella protezione del branch è
una scelta del repository, non una modifica fatta da questa PR.

Le PR già aperte (#58, #68, #69, #70 e #72 al momento dell'implementazione)
devono aggiungere la propria nota prima del merge. Non sono anticipate nella
pagina. Dopo il merge le loro note saranno raccolte dalla build che include i
rispettivi cambiamenti, senza aggiornare manualmente una lista centrale.
Se più PR vengono distribuite insieme, il popup mostra solo il rilascio più
recente; lo storico contiene tutte le note incluse. È possibile raccogliere più
cambiamenti in un unico file quando il team prepara un rilascio unico.

## Build, Render e rollback

`node scripts/release-notes.mjs` valida la fonte. Vite esegue lo stesso controllo
prima della build e genera `web/dist/release-manifest.json`: solo note pubbliche,
ordine dal più recente, identificativo corrente. Docker porta questo manifesto
nel servizio FastAPI insieme alla build React. L'API aggiunge la versione del
commit corrente (`RENDER_GIT_COMMIT`, come per l'avviso di aggiornamento #11).

Non c'è una pubblicazione anticipata su database o un webhook da configurare:
le note diventano visibili dal servizio che Render mette in traffico dopo il
deploy riuscito. Un build/deploy fallito o annullato lascia in servizio il vecchio
manifesto. Il frontend confronta il commit compilato con quello dell'API prima
di aprire il popup: una scheda vecchia continua a usare l'avviso “nuova versione”,
e annuncia le novità soltanto dopo il reload. Questo confronto vale in produzione;
in sviluppo, la versione `dev` consente di provare le note locali.

Un rollback dell'artefatto ripristina anche lo storico e il rilascio corrente.
Non ritira note da un database remoto: il nuovo manifesto non è più servito.
Una scheda aperta rivalida le note ogni minuto e quando torna in primo piano;
se la versione non coincide o il rilascio è stato ritirato, il popup scompare.
Un redeploy identico mantiene lo stesso id. Se la nota più recente è interna,
`current` è `null`: lo storico rimane disponibile e non ci sono annunci.
In produzione, senza un manifesto, l'API restituisce uno storico vuoto; non
pubblica note lette da un checkout o da PR non distribuite.

## Preferenze e priorità

Gli account ufficiali salvano gli id visti nella nuova tabella `releaseseen`,
creata dal normale `init_db`, anche sui database esistenti. GET/POST
`/api/release-preference` usa solo l'account della sessione: mai un id fornito
dal browser. Il vincolo unico gestisce richieste ripetute e schede concorrenti.
L'account scuola salva la stessa preferenza. Nella demo si usa esclusivamente
`recapp.releases.demo` in localStorage, comune alle sessioni e ai nickname demo.

Il primo utilizzo stabilisce la versione corrente come punto di partenza e dà
precedenza al tutorial. Gli utenti che hanno già visto il tutorial ricevono il
riepilogo del nuovo rilascio. Il popup aspetta una schermata pronta per almeno
800 ms: editor chiuso, niente modifiche pendenti, salvataggi, input in scrittura,
menu, altri dialoghi o transizioni di pagina. Non forza un salvataggio.
Chiudi, Esc, clic sullo sfondo, Ho capito e Leggi tutte le novità ricordano
il rilascio. Anche aprire direttamente le note complete con una sessione attiva
lo ricorda. Un errore delle note o delle preferenze non interrompe l'app.
Un salvataggio account fallito mantiene una copia locale e viene ritentato
alla visita successiva; la sincronizzazione tra dispositivi richiede un POST riuscito.

Il dialogo nativo rende inerte lo sfondo, contiene Tab/Shift+Tab, ha titolo e
descrizione per gli screen reader e ripristina il focus. Non usa animazioni;
la pagina segue i controlli esistenti di lingua e tema e il movimento ridotto.

## Verifiche

```bash
.venv/bin/python -m pytest api/tests -q
node scripts/release-notes.mjs
cd web
npm run build
npm run lint
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --config playwright.releases.config.ts
```

La suite dedicata verifica pagina pubblica, storico, immagini/link protetti,
demo e account, tutorial, editor, salvataggi, focus, lingue, temi, telefono a
320 px, testo ingrandito, movimento ridotto, versione vecchia ed errori opzionali.
I test API coprono lo stesso manifesto della build, rollback, preferenze tra
dispositivi/account, demo, id non pubblicati, note non valide e aggiornamenti interni.
Screenshot e video della PR provengono dalla build di produzione con API locale.
