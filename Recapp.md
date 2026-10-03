# Recapp

Team: 3 · ITI Marconi Verona, 4ª Informatica  
Hackathon: [CSC Back-to-School](https://csc-back-to-school.devpost.com/) · submit **domenica 4 ottobre 2026, sera Italia**  
Visione: un posto solo per *ieri + compiti + verifiche + eventi*, al posto di tre bacheche.  
MVP hackathon: la classe scrive quel posto. I collegamenti automatici arrivano dopo.

Tagline EN: *Three school apps. One card. Missed a day? Open yesterday — and see what’s due next.*

---

## 0. Come leggere questo foglio

Tre strati. Non sono lo stesso prodotto.

| Strato | Quando | Cosa |
|---|---|---|
| **A — CSC / 5 giorni** | ora → 4 ott | Card del giorno + compiti/verifiche/eventi **scritti dal verbalista** + lista “in arrivo” |
| **B — subito dopo** | ottobre, se il pilota gira | Screenshot → testo (Featherless). Digest Telegram/email |
| **C — scuola** | solo con permesso | Collegamento ufficiale Classroom (OAuth). ClasseViva **non** si aggancia con le password degli studenti |

Se mescolate A e C questa settimana, non finite né l’uno né l’altro.

---

## 1. Problema (quello che avete detto voi)

A Marconi i materiali vivono in **tre posti**:

1. **ClasseViva / Spaggiari** — registro: argomenti, compiti, agenda, circolari  
2. **Google Classroom** — consegne, file, stream  
3. **Campus** — contenuti didattici della scuola (dentro Apps Marconi / Guglielmo, login Google Workspace)

Nessuno dei tre è “la verità”.  
Risultato: in chat si chiede ogni sera *che compiti ci sono, se c’è verifica, dove sta il file*.  
Chi è assente perde anche *cosa è successo in lab* — e quello non sta in nessuno dei tre.

Due buchi, non uno:

- **Dietro di te:** cosa abbiamo fatto ieri (soprattutto lab)  
- **Davanti a te:** cosa c’è da fare / quando c’è verifica / se c’è un evento

WhatsApp non li unisce. Il registro non spiega il lab. Classroom non sa la verifica di matematica.

---

## 2. Cosa è / cosa non è

| È | Non è |
|---|---|
| Un **hub di classe** scritto da chi c’era | Un clone di ClasseViva |
| Ieri + in arrivo, in una pagina | Tre login in più |
| After-school o PC del lab | App da usare col telefono *in ora* |
| Screenshot come *aiuto* al redattore | Login con le password Spaggiari |
| Pilota di una classe | Portale ufficiale dell’istituto |

Nome: **Recapp**.

---

## 3. Valutazione onesta dei collegamenti

### ClasseViva / Spaggiari

Esiste un’API REST (`web.spaggiari.eu/rest`) usata dall’app ufficiale. **Non è un’API pubblica per terze parti.** I wrapper su GitHub fanno login con utente e password dello studente.  

Per un progetto **pubblico** di tre minorenni:

- dovreste conservare credenziali scolastiche  
- ToS Spaggiari + Garante: dati di registro non si spargono  
- il repo CSC è visibile  
- un keylogger involontario (password in chiaro nel `.env` committato) è un incidente, non una feature  

**Strato C: no.** Nemmeno “in locale, tanto siamo bravi”.

### Google Classroom

API **ufficiale** (OAuth, elenco CourseWork). Serve progetto Google Cloud, schermata consenso, spesso ok dell’admin Workspace della scuola. Fattibile in teoria, non in 5 giorni senza la preside/animatore digitale che sblocca.  

**Strato C, dopo l’hackathon, se la scuola dice sì.**

### Campus (Marconi)

È il contenitore didattico interno, raggiungibile da Apps Marconi / Guglielmo con account Google della scuola. **Nessuna API pubblica.**  

**Solo screenshot o link copiato a mano.**

### La via che regge

Il redattore non “si collega”. **Porta lui** il pezzo utile:

- incolla 1 riga (“Mate: es. 12–15, verifica ven”)  
- oppure carica uno **screenshot ritagliato** (solo compito/agenda, niente voti)  
- Featherless (strato B) prova a leggere: *compito / verifica / evento + data*

La classe ottiene un posto solo. I tre sistemi restano la fonte ufficiale. Voi siete il riassunto.

---

## 4. Vincoli che restano

- **Telefoni in ora:** circolare MIM 3392/2025. Compilazione e lettura **dopo campanella**, a casa, o dal **browser del PC lab**.  
- **Preside:** pilota ok, “serve formazione” → template + 1 verbalista, non un corso.  
- **Privacy:** niente voti, note, assenze ufficiali, diagnosi, foto volti, password.  
- **CSC:** progetto nuovo e pubblico. No AppVinili / Synara. Disclosure AI.  
- **Tempo:** submit 4 ott sera. Perk Render partecipanti fino al **1 ott**.

---

## 5. Strato A — quello che si consegna

### Due viste, un database

1. **Ieri** — card del giorno (come già speccato)  
2. **In arrivo** — lista piatta di item con data, presi dalle card + inseriti a parte

Un item `In arrivo` ha:

| Campo | Valori |
|---|---|
| Tipo | `compito` / `verifica` / `evento` / `lab` |
| Materia | testo libero o lista orario |
| Titolo | una riga |
| Quando | data (e ora se evento) |
| Fonte | `detto in classe` / `ClasseViva` / `Classroom` / `Campus` / `altro` |
| Link | opzionale |
| Screenshot | opzionale, ritagliato |

Il verbalista, mentre scrive *ieri*, spunta anche “c’è verifica mercoledì” → nasce un item In arrivo.  
Non è un secondo prodotto: è la stessa form, sezione sotto.

### Card del giorno (campi)

| Campo | Obbligatorio |
|---|---|
| Data + classe | sì |
| Nick autore | sì |
| Materie: max 5 bullet “cosa abbiamo fatto” | almeno 1 |
| Blocco **Lab** (obiettivo, repo, trappola, cosa portare) | se c’è stato lab |
| Compiti / verifiche / eventi nati oggi | no, ma è il pezzo nuovo |
| Allegato (screenshot ritagliato o link) | no |

### Esempio

> **29 set · 4ª INF** · `leo`  
> **Informatica (lab)** — API GET /stazioni · repo `4inf-lab-set` · manca `uvicorn --reload` · porta GitHub  
> **Matematica** — derivate 3–7 pag. 112  
> **In arrivo**  
> - compito Mate · 1 ott · fonte: ClasseViva  
> - verifica Mate · 3 ott · fonte: detto in classe  
> - evento · assemblea 7 ott · fonte: Campus

### Schermate (6, stop)

1. Entra in classe (codice + PIN per scrivere)  
2. Home: **Ieri** | **In arrivo**  
3. Lista giorni  
4. Card del giorno  
5. Compila oggi (materie + lab + “aggiungi in arrivo”)  
6. In arrivo (filtro: compiti / verifiche / eventi / questa settimana)

Fuori dallo strato A: OAuth, scraping, push, app nativa, chat, voti.

### Anti-vuoto

- Template orario della 4ª già in checkbox  
- Un verbalista al giorno, nick in home  
- Seed **5 card + 8 item in arrivo** veri (compiti/verifiche della settimana prossima)  
- Se nessuno scrive le materie: tenete almeno **lab + in arrivo**  
- Lettura senza account  

### Featherless nello strato A (solo se venerdì avanza)

Bottone sulla card: **versione più semplice** / **ascolta**.  
Non svolge i compiti.

---

## 6. Strato B — dopo il submit (o venerdì se siete avanti)

### Screenshot → bozza

Il redattore carica una foto *già ritagliata* (agenda ClasseViva, assignment Classroom, avviso Campus).

Featherless restituisce JSON:

```json
{
  "tipo": "compito|verifica|evento",
  "materia": "",
  "titolo": "",
  "quando": "2026-10-03",
  "fonte": "ClasseViva|Classroom|Campus"
}
```

Il redattore **accetta o corregge**. Mai pubblicazione automatica: l’OCR sbaglia le date.

Regola screenshot: niente colonna voti, niente nomi compagni, niente badge. Se si vede un 6, non si carica.

### Notifiche

Non in ora (telefono spento). Sì **dopo le 16:30**.

Ordine di costo:

1. **Telegram** — un bot, un gruppo classe, un messaggio: “Recapp è online” / “verifica Mate tra 2 giorni”  
2. Email — più attrito (spam, scuola)  
3. Push native — no, non c’è tempo

Il bot non legge il registro. Legge **solo** ciò che è già in Recapp.

n8n: usatelo solo se lo riscattate. Altrimenti un cron FastAPI / un Render Workflow.

---

## 7. Strato C — solo con la scuola

| Piattaforma | Cosa si può fare per davvero | Cosa non fate |
|---|---|---|
| Classroom | OAuth ufficiale, lista assignment della classe | niente senza progetto Cloud + ok admin |
| Campus | niente API; restano link e screenshot | non loggarsi col account Google della scuola nel vostro server |
| ClasseViva | niente di lecito in un repo pubblico | **niente password studenti nel backend** |

Se un giorno la preside vuole l’integrazione, si parte da Classroom (l’unica porta pulita).

---

## 8. Privacy

- Codice classe, nick, niente cognomi  
- Vietato: voti, note, assenze ufficiali, PDP, foto volti  
- Screenshot = ritaglio. Se dubitate, non caricate  
- Password: solo PIN della classe. Mai credenziali Spaggiari/Google  
- README: *Students type what they remember. We don’t log into the gradebook.*

---

## 9. Stack strato A

```
React (mobile-first, sera / bus)
    ↓
FastAPI + SQLite
    day_cards
    upcoming_items
    ↓
Render  (live entro 1 ott)  +  .xyz
```

```
Recapp/
  README.md          inglese
  web/
  api/
    app.py
    models.py
    seed.py
  uploads/           solo ritagli, niente originali pieni di voti
  .env.example
```

Chiavi Featherless in `.env`, mai committate.

---

## 10. Chi fa cosa (5 giorni)

| Chi | Strato A |
|---|---|
| Uno | FastAPI: card + upcoming + seed + deploy |
| Uno | React: home Ieri/In arrivo, form, lista |
| Uno | 5 card + 8 scadenze vere, README EN, video 90 s |

| Quando | Done |
|---|---|
| Mer 30 | repo, 1 card, 3 item in arrivo |
| Gio 1 ott | sito live (Render o fallback) |
| Ven 2 | form + blocco lab + home a due tab |
| Sab 3 | seed completi, video, disclosure AI |
| Dom 4 | Devpost + opt-in premi. Non a mezzanotte PDT |

Screenshot-OCR e Telegram: **dopo** il video, se avanzano ore. Non prima del form.

---

## 11. Demo 60 secondi (EN)

> At our school homework lives in ClasseViva, files in Classroom, notes on Campus.  
> I missed lab on Tuesday. I open Recapp: the repo, the command that broke, math test Friday.  
> We don’t log into those three apps. The class writes one card.

Criteri CSC: Impact (tre canali + lab), Learning (perché l’aggregatore ufficiale è un vicolo cieco), Functionality (due tab che si aprono).

---

## 12. Cosa dire alla preside

> Non sostituiamo ClasseViva, Classroom o Campus. Facciamo il riassunto della classe: ieri + cosa scade. Pilota 4ª Informatica. Niente password, niente voti. Se dopo l’hackathon volete Classroom collegato per davvero, si parla con l’animatore digitale.

---

## 13. Decisioni da scrivere qui

```
Nome pubblico:
Scope card: tutte le materie  /  solo lab + in arrivo
Verbalisti (nick + giorni):
Codice classe + PIN:
URL demo:
Deploy Render entro 1 ott: sì / fallback
Screenshot in MVP: no (A)  /  sì se venerdì (B)
Telegram: dopo il submit
```
