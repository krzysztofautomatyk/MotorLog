-- Indexed View for blazing fast Metadata Queries (Zone/Line/Motor hierarchy)
-- Run in MotorLogDB
IF OBJECT_ID ('dbo.V_MotorHierarchy', 'V') IS NOT NULL BEGIN
-- Dropping view automatically drops its indexes
DROP VIEW dbo.V_MotorHierarchy;

END GO
CREATE VIEW dbo.V_MotorHierarchy
WITH
    SCHEMABINDING AS
SELECT
    Zone,
    Line,
    MotorName,
    COUNT_BIG (*) AS LogCount
FROM
    dbo.MotorLogs
WHERE
    Zone IS NOT NULL
    AND Line IS NOT NULL
    AND MotorName IS NOT NULL
GROUP BY
    Zone,
    Line,
    MotorName;

GO
-- Create the Clustered Index to materialize the view
-- This makes querying this view instant (scanning unique motors vs millions of logs)
CREATE UNIQUE CLUSTERED INDEX IX_V_MotorHierarchy ON dbo.V_MotorHierarchy (Zone, Line, MotorName);

GO