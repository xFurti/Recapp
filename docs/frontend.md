# Frontend

React 19 + TypeScript, Vite, Tailwind CSS 4, TanStack Query, React Router, react-i18next,
icone lucide-react. Mobile-first: su telefono barra in basso con 4 tab, da PC barra laterale.

## Pagine

| Percorso | File | Cosa mostra |
| --- | --- | --- |
| `/` | `pages/Landing.tsx` | Codice classe, "Prova la demo", link Area scuola e Privacy |
| `/c/:code/entra` | `pages/Join.tsx` | Scelta del nick, PIN pad o primo accesso con invito |
| `/c/:code` | `pages/Today.tsx` | Banner del verbalista, lezioni di oggi, scadenze a 3 giorni |
| `/c/:code/ieri` | `pages/DayPage.tsx` (`Yesterday`) | Ultima giornata pubblicata, frecce, Ascolta |
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
- **Pubblica**: forza un ultimo salvataggio, poi `POST /publish`, invalida le cache e torna a Oggi.

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
