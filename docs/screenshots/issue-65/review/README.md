# PR #68 — verifica del modulo con la sola data

Screenshot reali del dialogo `ItemForm`, acquisiti con Chromium tramite
`web/tests/item-dates.spec.ts`. Il test monta le pagine e i componenti React
effettivi; le sole risposte HTTP e i dati sono simulati.

- `before-*`: versione iniziale della PR, commit `cd8bf16`.
- `after-*`: versione aggiornata, integrata con `main` (`9945c3a`).
- `*-desktop-it-light.png`: viewport 1280×900, italiano, tema chiaro.
- `*-phone-en-dark.png`: viewport 390×900, inglese, tema scuro.

Le immagini ritagliano il dialogo e usano gli stessi dati e la stessa data
simulata prima e dopo. Il selettore resta a larghezza piena; l'integrazione
conserva anche il blocco dei campi durante l'invio delle correzioni. La review
non cambia le animazioni, quindi non è richiesta una registrazione.

Gli allegati diretti GitHub non erano disponibili nel browser dell'ambiente;
le immagini sono conservate qui, nel percorso già usato dal progetto per le
prove visive, e collegate dal commento sulla PR.
