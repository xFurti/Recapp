# Archivio completo — issue #106

Screenshot reali della build di produzione e registrazione Chromium, con API FastAPI
locale e database SQLite isolato. Nessuna risposta HTTP simulata: «4B · Classe di
prova» e Ada sono dati sintetici, con pubblicazioni, bozze e giornate mancanti lungo
l'anno scolastico 2026/27. L'orologio di test è il 15 giugno 2027; non sono usati
account, classi o dati di produzione. Non è stato eseguito un deploy.

| File | Viewport | Stato |
| --- | --- | --- |
| `desktop-archive-month.png` | 1440 × 1000 | Italiano, chiaro: ottobre 2026, pubblicazioni e bozza non pubblicata nello stesso periodo. |
| `desktop-load-more.png` | 1440 × 1000 | Italiano, chiaro: prima pagina di 30 giornate e pulsante Carica altre. |
| `phone-archive-range.png` | 390 × 844 | Italiano, chiaro: intervallo inclusivo 12–23 ottobre 2026. |
| `phone-subject-month-dark.png` | 390 × 844 | Italiano, scuro: Informatica aperta dall'archivio mantiene ottobre 2026. |
| `small-phone-month-en.png` | 320 × 740 | Inglese, scuro: mese e navigazione, con azione di recupero su una bozza. |
| `small-phone-empty-en.png` | 320 × 740 | Inglese, scuro: nessuna giornata prima del periodo di attività della classe. |

La registrazione `docs/media/issue-106/navigation.webm` mostra Carica altre, cambio
del periodo, passaggio alla materia e ritorno dalla giornata, sulla stessa build con
API reale. Il movimento ridotto fissa il layout nelle prove. Il controllo live ha
caricato 120 giornate, aperto una giornata e ritrovato tutte le pagine al ritorno e
dopo il reload, senza errori JavaScript.

I test browser con HTTP simulato verificano separatamente latenza, errori e retry,
fine dei risultati, storico completo (250 giornate, 454 blocchi), tastiera, filtri,
posizione e cronologia. I test API verificano calendario e permessi reali, oltre 200
pubblicazioni e blocchi dello stesso giorno divisi tra pagine. WebKit non è eseguibile
su questo host: manca `libicudata.so.74`; non è una verifica su Safari fisico.

I media sono conservati nelle cartelle già previste dal progetto e collegati nella
PR con URL fissati al commit, senza scadenza. Non era disponibile un canale di upload
per gli allegati GitHub; non sono stati usati servizi esterni.
