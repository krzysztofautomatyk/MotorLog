# Optymalizacja bazy danych MotorLog (MSSQL)

## Cel
Przyspieszyć zapytania dla list stref/linie/silniki oraz danych do wykresów poprzez eliminację pełnych skanów tabeli i redukcję powtarzanych agregacji.

> ⚠️ **KRYTYCZNE**: Bez tych indeksów aplikacja będzie działać ekstremalnie wolno (30+ sekund zamiast <0.1s)!

## Indeksy

### 1) Główny indeks kompozytowy (WYMAGANY)
```sql
CREATE INDEX IX_MotorLogs_ZoneLineMotor_TS
ON dbo.MotorLogs (Zone, Line, MotorName, ProductionWeek, [Timestamp])
INCLUDE (MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime);
```
- Przyspiesza /api/zones, /api/lines, /api/motors oraz /api/motor-logs i /api/motor-logs-latest.
- Kolumny INCLUDE eliminują potrzebę key lookup.

### 2) Filtr tygodnia produkcyjnego
```sql
CREATE INDEX IX_MotorLogs_ProductionWeek
ON dbo.MotorLogs (ProductionWeek);
```
- Przyspiesza filtrowanie po tygodniach w endpointach wykresów.

### 3) Filtr dnia tygodnia (persisted computed column)
```sql
ALTER TABLE dbo.MotorLogs
ADD DayOfWeek AS (DATEPART(WEEKDAY, [Timestamp])) PERSISTED;

CREATE INDEX IX_MotorLogs_DayOfWeek
ON dbo.MotorLogs (Zone, Line, MotorName, DayOfWeek, [Timestamp])
INCLUDE (ProductionWeek, MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime);
```
- Utrwala wyliczenie DayOfWeek i umożliwia seek przy filtrze dni.

### 4) Statystyki po indeksach
```sql
UPDATE STATISTICS dbo.MotorLogs WITH FULLSCAN;
```
- Stabilizuje plany wykonywania po utworzeniu nowych indeksów.

## Indexed View dla metadanych (WYMAGANY)

Widok materializowany dla błyskawicznych zapytań o hierarchię Zone/Line/Motor:

```sql
CREATE VIEW dbo.V_MotorHierarchy WITH SCHEMABINDING AS
SELECT 
    Zone,
    Line,
    MotorName,
    COUNT_BIG(*) AS LogCount
FROM dbo.MotorLogs
WHERE Zone IS NOT NULL AND Line IS NOT NULL AND MotorName IS NOT NULL
GROUP BY Zone, Line, MotorName;
GO

CREATE UNIQUE CLUSTERED INDEX IX_V_MotorHierarchy 
ON dbo.V_MotorHierarchy (Zone, Line, MotorName);
```

- Zapytania /api/zones, /api/lines, /api/motors używają tego widoku z hintem `WITH (NOEXPAND)`.
- Zamiast skanować miliony wierszy, skanuje tylko unikalne kombinacje (dziesiątki/setki wierszy).

## Pełny skrypt instalacyjny

Uruchom `server/db-indexes.sql` a następnie `server/db-view.sql` w kolejności.

Lub wykonaj wszystko naraz:

```sql
-- Wybierz bazę danych
USE MotorLogDB;
GO

-- 1. Indeksy
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotorLogs_ZoneLineMotor_TS' AND object_id = OBJECT_ID('dbo.MotorLogs'))
    DROP INDEX IX_MotorLogs_ZoneLineMotor_TS ON dbo.MotorLogs;
GO

CREATE INDEX IX_MotorLogs_ZoneLineMotor_TS
ON dbo.MotorLogs (Zone, Line, MotorName, ProductionWeek, [Timestamp])
INCLUDE (MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime);
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotorLogs_ProductionWeek' AND object_id = OBJECT_ID('dbo.MotorLogs'))
    DROP INDEX IX_MotorLogs_ProductionWeek ON dbo.MotorLogs;
GO

CREATE INDEX IX_MotorLogs_ProductionWeek
ON dbo.MotorLogs (ProductionWeek);
GO

IF COL_LENGTH('dbo.MotorLogs', 'DayOfWeek') IS NULL
BEGIN
    ALTER TABLE dbo.MotorLogs
    ADD DayOfWeek AS (DATEPART(WEEKDAY, [Timestamp])) PERSISTED;
END;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotorLogs_DayOfWeek' AND object_id = OBJECT_ID('dbo.MotorLogs'))
    DROP INDEX IX_MotorLogs_DayOfWeek ON dbo.MotorLogs;
GO

CREATE INDEX IX_MotorLogs_DayOfWeek
ON dbo.MotorLogs (Zone, Line, MotorName, DayOfWeek, [Timestamp])
INCLUDE (ProductionWeek, MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime);
GO

UPDATE STATISTICS dbo.MotorLogs WITH FULLSCAN;
GO

-- 2. Indexed View
IF OBJECT_ID('dbo.V_MotorHierarchy', 'V') IS NOT NULL
    DROP VIEW dbo.V_MotorHierarchy;
GO

CREATE VIEW dbo.V_MotorHierarchy WITH SCHEMABINDING AS
SELECT 
    Zone,
    Line,
    MotorName,
    COUNT_BIG(*) AS LogCount
FROM dbo.MotorLogs
WHERE Zone IS NOT NULL AND Line IS NOT NULL AND MotorName IS NOT NULL
GROUP BY Zone, Line, MotorName;
GO

CREATE UNIQUE CLUSTERED INDEX IX_V_MotorHierarchy 
ON dbo.V_MotorHierarchy (Zone, Line, MotorName);
GO
```

## Cache po stronie API

W `server/server.js` zaimplementowano lekki cache (Map) z TTL dla metadanych:
- strefy: 60 s
- linie: 30 s
- silniki: 30 s
- tygodnie: 300 s

Deduplication in-flight promises zapobiega równoległym zapytaniom o te same dane.

## Oczekiwany efekt

| Zapytanie | Przed optymalizacją | Po optymalizacji |
|-----------|---------------------|------------------|
| /api/zones | 5-30 s (full scan) | <50 ms |
| /api/lines | 3-15 s (full scan) | <50 ms |
| /api/motors | 3-15 s (full scan) | <50 ms |
| /api/motor-logs | 10-60 s (full scan) | 100-500 ms |
| /api/motor-logs-latest | 5-30 s | <100 ms |

## Kroki wdrożenia

1. **Uruchom skrypty SQL** w docelowej bazie MotorLogDB
2. **Sprawdź plany zapytań** - oczekiwany jest Index Seek zamiast Table Scan
3. **Zweryfikuj cache** - drugie wywołanie /api/zones powinno być natychmiastowe
4. **Opcjonalnie** - zmniejsz okno auto-refresh do 5-10 minut dla mniejszych payloadów

## Troubleshooting

Jeśli nadal wolno:
1. Sprawdź czy indeksy zostały utworzone: `SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.MotorLogs')`
2. Sprawdź czy widok istnieje: `SELECT * FROM sys.views WHERE name = 'V_MotorHierarchy'`
3. Sprawdź plan zapytania: `SET STATISTICS IO ON; SET STATISTICS TIME ON;` przed zapytaniem
