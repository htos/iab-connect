Titel
Requirements Workflow

Quelle
Requirements Inhalte: docs/Anforderungen_WebApp_Indischer_Kulturverein.csv
Status: docs/10_requirements_status.md

Ablauf
1) CSV lesen
2) Status Datei lesen
3) Status für neue IDs ergänzen mit Status Backlog und aktuellem Datum
4) docs/01_requirements.md aktualisieren als Sicht auf CSV plus Status
5) Status Updates nur in docs/10_requirements_status.md durchführen
6) CSV Inhalte werden nicht geändert ohne expliziten Auftrag

Matching
ID aus CSV wird verwendet um Status Einträge zuzuordnen
Format der ID ist REQ-NNN (zum Beispiel REQ-001, REQ-059)
Fehlende IDs werden automatisch ergänzt

Erlaubte Status Werte
Backlog
Ready
InProgress
Blocked
Done
Dropped
