-- Indexes to accelerate MotorLog queries for Zones/Lines/Motors and chart data
-- Run in the target database (MotorLogDB) with appropriate permissions.

-- 1) Core composite index for main filters
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_MotorLogs_ZoneLineMotor_TS' AND object_id = OBJECT_ID('dbo.MotorLogs')
)
BEGIN
    CREATE INDEX IX_MotorLogs_ZoneLineMotor_TS
    ON dbo.MotorLogs (Zone, Line, MotorName, [Timestamp]);
END;
GO

-- 2) ProductionWeek lookup (filters for week selection)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_MotorLogs_ProductionWeek' AND object_id = OBJECT_ID('dbo.MotorLogs')
)
BEGIN
    CREATE INDEX IX_MotorLogs_ProductionWeek
    ON dbo.MotorLogs (ProductionWeek);
END;
GO

-- 3) Optional: day-of-week filtering.
-- Adds a persisted computed column to avoid recalculating DATEPART for every row.
IF COL_LENGTH('dbo.MotorLogs', 'DayOfWeek') IS NULL
BEGIN
    ALTER TABLE dbo.MotorLogs
    ADD DayOfWeek AS (DATEPART(WEEKDAY, [Timestamp])) PERSISTED;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_MotorLogs_DayOfWeek' AND object_id = OBJECT_ID('dbo.MotorLogs')
)
BEGIN
    CREATE INDEX IX_MotorLogs_DayOfWeek
    ON dbo.MotorLogs (Zone, Line, MotorName, DayOfWeek, [Timestamp]);
END;
GO

-- 4) Refresh statistics for stable plans after creating indexes
UPDATE STATISTICS dbo.MotorLogs WITH FULLSCAN;
GO
