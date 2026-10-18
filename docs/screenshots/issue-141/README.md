# Partecipanti: prove visive della issue #141

Il prima proviene dalla build di produzione della base `6cc6421d909ce58fc4fd887566f326e238573cb1`; il dopo dalla build di questa PR. Entrambi aprono `/c/TEST/classe` con la stessa viewport, tema, lingua e risposte HTTP simulate. Sono screenshot reali dell’interfaccia React, non mockup. Le 25 identità sono fittizie: nickname univoci fino al limite supportato di 16 caratteri, anche senza spazi e con accenti; Admin, verbalista odierno, propria riga, attivazioni pendenti e contatori a zero o a più cifre.

Le risposte HTTP sono simulate per rendere confrontabili i casi: le immagini non dimostrano un flusso completo con API attiva. Le autorizzazioni server sono verificate separatamente dai test API di sicurezza. Non sono usati account o dati di classi reali.

Il browser condiviso del workspace ha restituito `BrowserHostUnavailable`; le immagini vengono quindi conservate nel percorso screenshot già usato dal repository e collegate dalla PR. Non hanno una scadenza legata a un servizio temporaneo.

## Prima e dopo

Le viste con nickname comuni mostrano la densità nell’uso quotidiano, scorrendo fino all’elenco con gli stessi controlli visibili: [telefono prima](before/390-usage-it.png), [telefono dopo](after/390-usage-it.png), [desktop prima](before/1280-usage-it.png), [desktop dopo](after/1280-usage-it.png). La matrice sotto mantiene i nomi alla massima lunghezza per verificare i casi più impegnativi.

| Viewport | Tema | Lingua | Prima | Dopo |
| --- | --- | --- | --- | --- |
| 320 px | light | it | [Prima](before/320-light-it.png) | [Dopo](after/320-light-it.png) |
| 320 px | light | en | [Prima](before/320-light-en.png) | [Dopo](after/320-light-en.png) |
| 320 px | dark | it | [Prima](before/320-dark-it.png) | [Dopo](after/320-dark-it.png) |
| 320 px | dark | en | [Prima](before/320-dark-en.png) | [Dopo](after/320-dark-en.png) |
| 390 px | light | it | [Prima](before/390-light-it.png) | [Dopo](after/390-light-it.png) |
| 390 px | light | en | [Prima](before/390-light-en.png) | [Dopo](after/390-light-en.png) |
| 390 px | dark | it | [Prima](before/390-dark-it.png) | [Dopo](after/390-dark-it.png) |
| 390 px | dark | en | [Prima](before/390-dark-en.png) | [Dopo](after/390-dark-en.png) |
| 1280 px | light | it | [Prima](before/1280-light-it.png) | [Dopo](after/1280-light-it.png) |
| 1280 px | light | en | [Prima](before/1280-light-en.png) | [Dopo](after/1280-light-en.png) |
| 1280 px | dark | it | [Prima](before/1280-dark-it.png) | [Dopo](after/1280-dark-it.png) |
| 1280 px | dark | en | [Prima](before/1280-dark-en.png) | [Dopo](after/1280-dark-en.png) |

## Testo ingrandito e tastiera

- [320 px, italiano, chiaro, testo al 200% e movimento ridotto](after/320-text-200.png).
- [390 px, inglese, scuro, testo al 200% e movimento ridotto](after/390-text-200.png).
- [390 px, inglese, scuro, menu aperto con tastiera e prima azione a fuoco](after/390-keyboard-menu.png).

Per gli screenshot le animazioni finite sono portate al termine, evitando fotogrammi intermedi. Le verifiche automatiche coprono geometria e sovrapposizioni delle singole porzioni di testo, allineamenti e area di tocco di ogni menu, tastiera e conferme. Non è stata effettuata una verifica su telefono fisico o con un lettore di schermo.
