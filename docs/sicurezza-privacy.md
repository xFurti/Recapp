# Sicurezza e privacy

## Accesso

| Chi | Come entra | Cosa può fare |
| --- | --- | --- |
| Partecipante | codice classe → nick → PIN di 6 cifre | Leggere la classe, aggiungere elementi in arrivo, scrivere la giornata nel suo turno |
| Admin (rappresentante) | come sopra, ruolo admin | In più: gestire partecipanti, inviti, turni, orario; scrivere sempre |
| Owner (dirigenza) | utente + password nell'Area scuola | Vedere tutte le classi in sola lettura, creare classi, gestire calendario, orari e inviti |
| Giudici / curiosi | "Prova la demo" | Solo la classe DEMO, rigenerata ogni giorno |

- **Primo accesso**: l'admin crea il nick e ottiene un **codice invito monouso** (`XXXX-XXXX`),
  mostrato una sola volta con QR. Lo studente lo usa per scegliere il PIN. Lo stesso meccanismo
  serve per il PIN dimenticato: un nuovo invito annulla il vecchio PIN.
- **PIN e inviti** sono salvati con bcrypt: nel database non c'è niente di leggibile.
- **Blocco**: 5 tentativi sbagliati bloccano il nick (o l'account owner) per 15 minuti. In più,
  massimo 40 tentativi di accesso ogni 10 minuti per indirizzo IP.

## Sessione

- Cookie `ieri_session` firmato con `SECRET_KEY` (itsdangerous), durata 30 giorni,
  `HttpOnly` (JavaScript non lo legge), `SameSite=Lax`, `Secure` in HTTPS.
- Dentro c'è solo tipo, id e `session_version`. Cambiare PIN, rigenerare l'invito o rimuovere un
  membro incrementa `session_version`: le sessioni vecchie smettono di valere.

## Protezioni sulle richieste

- **Controllo `Origin`**: POST/PUT/PATCH/DELETE da un sito diverso da `bassaleo.xyz`,
  `www.bassaleo.xyz` o `ieri.onrender.com` ricevono 403. Insieme a `SameSite=Lax` blocca le
  richieste fatte "a nome tuo" da altri siti.
- **Permessi lato server**: ogni endpoint controlla ruolo e turno; nascondere un bottone nella
  UI non basta e non è usato come protezione.
- **Validazione input**: Pydantic limita lunghezze (titoli 200, punti 300, note 1500), formati
  (PIN, ora, link) e quantità (5 punti per materia, 30 elementi per giornata).
- **Header**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.
- **Ora simulata** (`X-Ieri-Now`) accettata solo in sviluppo o nella classe DEMO.

## Dati

Salviamo: nick, ruolo, PIN cifrato, contenuti scritti dalla classe, ritagli ripuliti.

Non salviamo mai: password di ClasseViva, Google o Campus; voti, note disciplinari, assenze,
diagnosi, foto di volti; metadati delle immagini.

Chi legge: i membri della classe dopo l'accesso, la dirigenza in sola lettura. Fine anno: i
contenuti della classe vanno cancellati (operazione manuale per ora, vedi [operazioni.md](operazioni.md)).

## Segreti

- Le chiavi stanno solo nel `.env` locale (ignorato da git) e nelle Environment di Render.
- Codici classe e inviti reali compaiono solo nei log di Render e nell'Area scuola, mai nel repo.
- Prima di ogni commit controlliamo che `.env`, `.dev_secret` e i file `*.db` non siano inclusi.

## Limiti noti (da sapere se ve lo chiedono)

- Il limite per IP è in memoria: con più istanze del server non sarebbe condiviso. Oggi c'è una
  sola istanza.
- Il nick è visibile a chiunque conosca il codice classe (serve per sceglierlo all'accesso).
  Per questo il codice ha un suffisso casuale e i nick non devono contenere cognomi.
- Non c'è ancora una cancellazione automatica di fine anno né un export dei dati.
