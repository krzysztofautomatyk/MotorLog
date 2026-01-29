# Optymalizacja bazy danych MotorLog (MSSQL)

## Cel
Przyspieszyć zapytania dla list stref/linie/silniki oraz danych do wykresów poprzez eliminację pełnych skanów tabeli i redukcję powtarzanych agregacji.

## Indeksy
1) Główne filtry (widoki UI, wykresy)
```sql
CREATE INDEX IX_MotorLogs_ZoneLineMotor_TS
ON dbo.MotorLogs (Zone, Line, MotorName, [Timestamp]);
```
- Przyspiesza /api/zones, /api/lines, /api/motors oraz /api/motor-logs i /api/motor-logs-latest.

2) Filtr tygodnia produkcyjnego
```sql
CREATE INDEX IX_MotorLogs_ProductionWeek
ON dbo.MotorLogs (ProductionWeek);
```
- Przyspiesza filtrowanie po tygodniach w endpointach wykresów.

3) (Opcjonalnie) filtr dnia tygodnia
```sql
ALTER TABLE dbo.MotorLogs
ADD DayOfWeek AS (DATEPART(WEEKDAY, [Timestamp])) PERSISTED;

CREATE INDEX IX_MotorLogs_DayOfWeek
ON dbo.MotorLogs (Zone, Line, MotorName, DayOfWeek, [Timestamp]);
```
- Utrwala wyliczenie DayOfWeek i umożliwia seek przy filtrze dni.

4) Statystyki po indeksach
```sql
UPDATE STATISTICS dbo.MotorLogs WITH FULLSCAN;
```
- Stabilizuje plany wykonywania po utworzeniu nowych indeksów.

## Cache po stronie API
- W server/server.js dodano lekki cache (Map) z TTL dla metadanych:
  - strefy: 60 s
  - linie: 30 s
  - silniki: 30 s
  - tygodnie: 300 s
- Deduplication in-flight promes zapobiega równoległym zapytaniom o te same dane.

## Oczekiwany efekt
- Powtórne żądania /api/zones, /api/lines, /api/motors, /api/weeks powinny być <50 ms (cache hit).
- Zapytania wykresów wykonują seek zamiast scan dzięki indeksom; czas odpowiedzi powinien spaść z sekund do dziesiątek–setek ms przy dużej tabeli.
- Mniejsze obciążenie SQL i szybsza percepcja UI.

## Kroki wdrożenia
1. Uruchom skrypt indeksów: `server/db-indexes.sql` w docelowej bazie.
2. Po wdrożeniu sprawdź plany zapytań dla typowych parametrów – oczekiwany jest indeks seek.
3. Zweryfikuj cache: wykonaj dwa kolejne wywołania /api/zones i porównaj czasy (drugi powinien być natychmiastowy).
4. Opcjonalnie: zmniejsz okno auto-refresh (param `minutes` w /api/motor-logs-latest) do 5–10 minut, aby ograniczyć wielkość payloadów wykresu.
