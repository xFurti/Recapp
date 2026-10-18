# Frontend

React 19 + TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router, react-i18next,
icone lucide-react. Mobile-first: su telefono barra in basso con 4 tab, da PC barra laterale.

## Pagine

| Percorso | File | Cosa mostra |
| --- | --- | --- |
| `/` | `pages/Landing.tsx` | Codice classe, "Prova la demo", link Area scuola e Privacy |
| `/c/:code/entra` | `pages/Join.tsx` | Scelta del nick, PIN pad o primo accesso con invito |
| `/c/:code` | `pages/Today.tsx` | Banner del verbalista, lezioni di oggi, scadenze a 3 giorni |
| `/c/:code/ieri` | `pages/DayPage.tsx` (`Yesterday`) | Ultima giornata pubblicata, frecce, Ascolta, riga "Per materia" |
| `/c/:code/materia/:subject` | `pages/SubjectPage.tsx` | Tutti i recap di una materia (settimana, 2 settimane, tutto) |
| `/c/:code/giorno/:day` · `/giorni` | `pages/DayPage.tsx` | Un giorno preciso, elenco di tutti i giorni |
| `/c/:code/scrivi/:day` | `pages/Editor.tsx` | Editor della giornata |
| `/c/:code/in-arrivo` | `pages/Upcoming.tsx` | Compiti, verifiche, eventi, lab con filtri |
| `/c/:code/classe` | `pages/ClassPage.tsx` | Partecipanti, Turni, Orario |
| `/scuola` | `pages/SchoolArea.tsx` | Login owner, classi, calendario |
| `/privacy` | `pages/Privacy.tsx` | Informativa |

`ClassLayout.tsx` carica la classe una volta e la mette in un contesto (`useClass()`); se la
sessione manca rimanda a `/entra`. Editor, Classe, Area scuola e Privacy sono caricati solo quando
servono (`React.lazy`) per alleggerire la prima apertura.

## Stato e dati

- Tutte le chiamate passano da `src/api.ts` (`api.get/post/...`): stessa origine, cookie,
  messaggi d'errore del backend mostrati così come sono.
- TanStack Query tiene in cache le risposte. Chiavi principali: `['me']`, `['class', code]`,
  `['today', code]` (si aggiorna ogni minuto), `['card', code, day]`, `['upcoming', code, ...]`,
  `['members', code]`, `['rotation', code]`, `['timetable', code]`. Dopo una modifica si
  invalidano le chiavi interessate.
- Stato solo locale (mai sul server): lingua (`ieri.lang`), ora simulata (`ieri.simulatedNow`),
  elementi segnati come fatti (`ieri.done.<classe>`).

## Editor della giornata (`pages/Editor.tsx`)

La parte più delicata del frontend.

- **Stato iniziale**: se esiste una card la carica; altrimenti crea un blocco per ogni lezione del
  giorno (ore consecutive della stessa materia unite, lab aperto se l'aula inizia con `L`).
- **Salvataggio automatico**: ogni modifica passa da `update()`, che incrementa una versione;
  1,8 secondi dopo l'ultima modifica parte un `PUT`. I salvataggi sono in coda (`chain`), mai due
  insieme. Aprire l'editor **non** crea una bozza: il primo salvataggio parte solo dopo la prima
  modifica, altrimenti la classe vedrebbe "sta scrivendo" senza motivo.
- **ID degli elementi**: i nuovi elementi non hanno `id` finché il server non risponde;
  `assignIds()` li abbina alla risposta per tipo, titolo, data e materia, così il salvataggio
  successivo non li duplica.
- **Bozze AI** (`AiSources`): incolla o carica un ritaglio → `POST /ocr` → controllo ogni secondo
  → schede con Aggiungi / Modifica / Scarta. Date dubbie evidenziate in giallo.
- **Foto appunti**: in ogni blocco materia, massimo 3, con la stessa casella privacy dei ritagli.
- **Conflitti**: ogni salvataggio manda `revision`. Su 409 compare un banner con "Tieni le mie
  modifiche" o "Carica la versione salvata". L'editor si apre sempre da una copia fresca del server.
- **Pubblica**: forza un ultimo salvataggio, poi `POST /publish`, invalida le cache e torna a Oggi.

## Risposte e condivisione

- `components/Feedback.tsx`: sotto ogni giornata pubblicata, "Grazie" con contatore, commenti e
  correzioni (evidenziate finché non sono segnate come viste). Si aggiorna ogni 30 secondi. Sulla
  propria giornata il contatore è solo da leggere.
- `components/Thanks.tsx`: il cuore "Grazie" condiviso da giornate ed elementi. Su ogni elemento
  pubblicato (In arrivo, Oggi, card, pagina materia) il pulsante sta nella riga dei metadati;
  il clic aggiorna subito lo stesso elemento in tutte le cache della classe e invalida
  `contributions`. I pulsanti dello stesso elemento condividono l'attesa, anche se la vista
  cambia mentre la richiesta è in corso. Le letture precedenti sono cancellate prima
  dell'aggiornamento ottimistico; alla fine si rileggono elementi e riepilogo, anche se il server
  ha salvato il Grazie ma la risposta è andata persa. Sui propri elementi il conteggio è solo testo.
- `components/contributions.tsx` + `pages/Contributions.tsx` (`/c/:code/classe/contributi`):
  scheda compatta in Classe con giornate di fila, record e ultimi giorni (icona e testo per ogni
  stato), e la vista Contributi della classe con periodo, classifica dei Grazie (posizioni
  condivise, propria riga raggiungibile), stati vuoti, errore con Riprova e regole di conteggio.
  Su telefono la riga separa posizione/avatar/Grazie da nickname e contributi; giorni recenti
  e testi vanno a capo anche con caratteri al 200%, senza coprire i contatori.
- `components/ShareButton.tsx` + `lib/shareImage.ts`: immagine 1080×1350 con materie, scadenze e
  attribuzione della pubblicazione e dell'ultimo aggiornamento, senza note, condivisa col foglio
  di sistema oppure scaricata con link WhatsApp. L'autore della pubblicazione resta invariato.
- `components/CalendarButton.tsx` + `lib/calendar.ts`: ogni elemento pubblicato in In arrivo,
  Oggi, nelle card e nella pagina materia si può copiare in Google Calendar o scaricare come
  `.ics` per Calendario Apple. L'evento è giornaliero sulla `due_date`, ignora eventuali
  `due_time` e include solo tipo, materia, titolo, nome classe, fonte, link e indirizzo di
  In arrivo. Non include autore, note della giornata o dati della sessione e non modifica
  l'elemento su Recapp. Il menu usa un portal, resta sopra la barra mobile e supporta tastiera.
  Nelle righe complete l'azione sta nella riga dei metadati; dopo l'esportazione l'icona diventa
  una spunta per qualche istante e il download `.ics` mostra un avviso.

## Tema

`lib/theme.ts`: chiaro, scuro o come il sistema, salvato sul dispositivo (`ieri.theme`). Uno script
in `index.html` applica il tema prima del primo disegno per evitare il lampo bianco. I componenti
usano i token `surface`, `paper`, `ink` e le varianti soft, ridefiniti in `.dark` in `index.css`.

## Lingua

`src/i18n/it.json` e `en.json` hanno le stesse chiavi. Per aggiungere un testo: chiave in
entrambi i file, poi `t('sezione.chiave')`. Testi con parti in grassetto usano `<Trans>` con
`<b>`. I contenuti scritti dai compagni non vengono tradotti.

## Ora simulata

Il pulsante con l'orologio (solo in sviluppo e nella classe DEMO) salva un'ora finta nel
browser; `api.ts` la manda nell'header `X-Ieri-Now`. Il backend la accetta solo se
`APP_ENV=dev` o se la classe è DEMO: nelle classi vere in produzione non ha effetto.

## Design system

- Colori dal logo Marconi in `src/index.css`: bordeaux `#A02848` (azioni principali), azzurro
  compito, rosa verifica, viola evento, verde lab, giallo solo come sfondo con testo scuro.
- Ogni tipo ha anche icona ed etichetta: l'informazione non è mai solo nel colore.
- Componenti base in `components/ui.tsx`: `Button`, `Card`, `Modal`, `Chip`, `Segmented`,
  `Field`, `Avatar`, `Badge`, `EmptyState`, `Stairs` (le "scale" del logo).
- Aree toccabili di almeno 44 px, focus visibile, `prefers-reduced-motion` rispettato.

### Gerarchia delle superfici

Le regole condivise sono in `web/src/surfaces.css`, importato da `index.css`.
Usano esclusivamente i token del tema esistente: bordeaux, carta calda, inchiostro e
varianti di avviso si adattano anche al cambio tema animato, senza nuovi colori fissi.

| Livello | Quando usarlo | Trattamento ed esempi |
| --- | --- | --- |
| Principale | Il contenuto da leggere o consultare nella vista. | `surface-primary`: superficie piena, bordo appena bordeaux e ombra discreta. `DayCardView` aggiunge `day-sheet` (margine superiore bordeaux) e `day-sheet-heading`; le righe complete di In arrivo conservano colore, icona ed etichetta del tipo. |
| Supporto | Contenuti complementari, risposte, lezioni previste e stati vuoti. | `surface-support`: carta leggermente schiarita, bordo neutro e nessuna ombra. `Card surface="support"` espone la variante. Dentro una scheda, preferire `support-rule` (solo separatore laterale) per note e laboratorio, oppure `content-row` per gli elementi compatti che hanno già la barra colorata del tipo: evitare riquadri annidati. |
| Metadati | Autore, ultimo aggiornamento, provenienza e contesto. | `content-metadata`: testo secondario leggibile, senza sfondo né badge. L’attribuzione può andare a capo; le azioni accanto conservano colore, focus e nomi accessibili. Non applicare opacità all’intero gruppo. |

Per una scheda generica `Card` mantiene l’aspetto precedente; `surface="primary"`
e `surface="support"` sono scelte esplicite. Non trasformare ogni sezione in una
scheda: se appartiene allo stesso contenuto bastano un separatore o testo secondario.

Gli avvisi usano una gerarchia distinta dai contenuti:

- `notice-info`: testo e margine neutri per conferme ordinarie, pubblicazione e giorni senza scuola;
- `notice-action`: fondo bordeaux tenue per il proprio turno da scrivere o continuare;
- `notice-warning`: fondo giallo e margine più marcato per turni scoperti e correzioni aperte;
- `notice-error`: fondo rosa e testo dedicato per gli errori (`ErrorBox` mantiene `role="alert"`).

Testo e icone continuano a distinguere gli stati anche senza colore. Le note del
giorno e quelle di laboratorio non diventano avvisi solo perché contengono testo.
Non si aggiungono animazioni per stabilire la gerarchia.

La #128 applica queste regole a Oggi, giornata pubblicata e In arrivo sulla base
`6cc6421d909ce58fc4fd887566f326e238573cb1`. La #96 e la PR #99 sono ancora aperte:
timeline, ordine delle sezioni, griglie e microinterazioni di quel restyling non
sono importati. Nel loro futuro aggiornamento vanno conservate queste classi nei
componenti di Oggi. Possibili sovrapposizioni con #129 e #132: `ui.tsx`, `day.tsx`,
`items.tsx`, `Today.tsx` e l’importazione iniziale in `index.css`; la scala tipografica,
le larghezze e le griglie restano di competenza di quelle issue. Gli unici adattamenti
di flusso qui servono a far andare a capo i controlli e le attribuzioni al 200%.
