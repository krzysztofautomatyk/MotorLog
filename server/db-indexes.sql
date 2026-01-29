-- Indexes to accelerate MotorLog queries for Zones/Lines/Motors and chart data
-- Run in the target database (MotorLogDB).

-- 1) Core composite index for main filters (Optimized for Week Selection)
-- Putting ProductionWeek in the KEY allows seeking directly to the specific week's data
-- instead of scanning all timestamps for the motor.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotorLogs_ZoneLineMotor_TS' AND object_id = OBJECT_ID('dbo.MotorLogs'))
BEGIN
    DROP INDEX IX_MotorLogs_ZoneLineMotor_TS ON dbo.MotorLogs;
END;
GO

CREATE INDEX IX_MotorLogs_ZoneLineMotor_TS
ON dbo.MotorLogs (Zone, Line, MotorName, ProductionWeek, [Timestamp])
INCLUDE (MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime);
GO

-- 2) ProductionWeek lookup
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotorLogs_ProductionWeek' AND object_id = OBJECT_ID('dbo.MotorLogs'))
BEGIN
    DROP INDEX IX_MotorLogs_ProductionWeek ON dbo.MotorLogs;
END;
GO

CREATE INDEX IX_MotorLogs_ProductionWeek
ON dbo.MotorLogs (ProductionWeek);
GO

-- 3) DayOfWeek column and index
IF COL_LENGTH('dbo.MotorLogs', 'DayOfWeek') IS NULL
BEGIN
    ALTER TABLE dbo.MotorLogs
    ADD DayOfWeek AS (DATEPART(WEEKDAY, [Timestamp])) PERSISTED;
END;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MotorLogs_DayOfWeek' AND object_id = OBJECT_ID('dbo.MotorLogs'))
BEGIN
    DROP INDEX IX_MotorLogs_DayOfWeek ON dbo.MotorLogs;
END;
GO

CREATE INDEX IX_MotorLogs_DayOfWeek
ON dbo.MotorLogs (Zone, Line, MotorName, DayOfWeek, [Timestamp])
INCLUDE (ProductionWeek, MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime);
GO

-- 4) Refresh statistics
UPDATE STATISTICS dbo.MotorLogs WITH FULLSCAN;
GO
