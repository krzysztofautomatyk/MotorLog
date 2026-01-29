import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Siemens123!',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'MotorLogDB',
    port: Number(process.env.DB_PORT || 2000),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectionTimeout: 60000,
        requestTimeout: 300000
    }
};

const targetPoints = 50000;
const zone = 'DefaultZone';
const line = 'DefaultLine';
const motor = 'Motor 1';
const weekClause = "AND ProductionWeek IN ('26W05')";
const dayClause = "";

const query = `
      SET DATEFIRST 1;
      
      IF OBJECT_ID('tempdb..#FilteredData') IS NOT NULL DROP TABLE #FilteredData;

      CREATE TABLE #FilteredData (
        [Id] BIGINT PRIMARY KEY,
        [Timestamp] DATETIME2,
        [MotorName] NVARCHAR(255),
        [Zone] NVARCHAR(255),
        [Line] NVARCHAR(255),
        [ProductionWeek] NVARCHAR(50),
        [MaxCurrentLimit] FLOAT,
        [MotorCurrent] FLOAT,
        [IsMotorOn] BIT,
        [AvgCurrent] FLOAT,
        [RunningTime] FLOAT,
        [PrevState] INT
      );

      INSERT INTO #FilteredData
      SELECT 
          [Id],
          [Timestamp],
          [MotorName],
          [Zone],
          [Line],
          [ProductionWeek],
          [MaxCurrentLimit],
          [MotorCurrent],
          [IsMotorOn],
          [AvgCurrent],
          [RunningTime],
          LAG(CAST([IsMotorOn] AS INT), 1, -1) OVER (ORDER BY [Timestamp])
      FROM [dbo].[MotorLogs]
      WHERE [MotorName] = @motor
        AND [Zone] = @zone
        AND [Line] = @line
        ${weekClause}
        ${dayClause};

      DECLARE @TotalCount INT;
      SELECT @TotalCount = COUNT(*) FROM #FilteredData;
      
      IF @TotalCount <= ${targetPoints}
      BEGIN
         SELECT 
            [Id],
            FORMAT([Timestamp], 'yyyy-MM-dd HH:mm:ss.fff') AS [Timestamp],
            [MotorName],
            [Zone],
            [Line],
            [ProductionWeek],
            [MaxCurrentLimit],
            [MotorCurrent],
            [IsMotorOn],
            [AvgCurrent],
            [RunningTime]
         FROM #FilteredData
         ORDER BY [Timestamp] ASC;
         
         DROP TABLE #FilteredData;
         RETURN;
      END

      -- Strict Downsampling
      -- Divide by 3 because we might pick up to 3 points per bucket (First, Min, Max)
      DECLARE @Buckets INT = ${Math.floor(targetPoints / 3)};
      IF @Buckets < 1 SET @Buckets = 1;
      
      DECLARE @StartTime DATETIME2;
      DECLARE @EndTime DATETIME2;
      DECLARE @DurationSeconds FLOAT;
      
      SELECT @StartTime = MIN([Timestamp]), @EndTime = MAX([Timestamp]) FROM #FilteredData;
      SET @DurationSeconds = DATEDIFF(SECOND, @StartTime, @EndTime);
      IF @DurationSeconds <= 0 SET @DurationSeconds = 1;

      ;WITH Bucketed AS (
          SELECT 
            *,
            CAST( DATEDIFF(SECOND, @StartTime, [Timestamp]) / (@DurationSeconds / @Buckets) AS INT) as BucketId
          FROM #FilteredData
      ),
      Ranked AS (
          SELECT 
             *,
             -- Rank items to pick exactly one Min and one Max per bucket
             ROW_NUMBER() OVER (PARTITION BY BucketId ORDER BY MotorCurrent ASC) as RankMin,
             ROW_NUMBER() OVER (PARTITION BY BucketId ORDER BY MotorCurrent DESC) as RankMax,
             ROW_NUMBER() OVER (PARTITION BY BucketId ORDER BY [Timestamp] ASC) as RankFirst
          FROM Bucketed
      ),
      SelectedPoints AS (
          -- 1. State Changes (Critical)
          SELECT * FROM Bucketed WHERE CAST([IsMotorOn] AS INT) <> PrevState
          
          UNION
          
          -- 2. First point of bucket (Regularity)
          SELECT * FROM Ranked WHERE RankFirst = 1
          
          UNION
          
          -- 3. Max Current (Peaks)
          SELECT * FROM Ranked WHERE RankMax = 1
          
          UNION

          -- 4. Min Current (Valleys)
          SELECT * FROM Ranked WHERE RankMin = 1
      )
      SELECT DISTINCT
        [Id],
        FORMAT([Timestamp], 'yyyy-MM-dd HH:mm:ss.fff') AS [Timestamp],
        [MotorName],
        [Zone],
        [Line],
        [ProductionWeek],
        [MaxCurrentLimit],
        [MotorCurrent],
        [IsMotorOn],
        [AvgCurrent],
        [RunningTime]
      FROM SelectedPoints
      ORDER BY [Timestamp] ASC
      OPTION (RECOMPILE);
      
      DROP TABLE #FilteredData;
`;

async function run() {
    let pool;
    try {
        console.log('Connecting...');
        pool = await sql.connect(config);
        console.log('Connected.');

        const request = pool.request();
        request.input('zone', sql.NVarChar, zone);
        request.input('line', sql.NVarChar, line);
        request.input('motor', sql.NVarChar, motor);

        console.log('Executing query...');
        const result = await request.query(query);
        console.log(`Success! Returned ${result.recordset.length} rows.`);

    } catch (err) {
        console.error('SQL Error:', err);
    } finally {
        if (pool) await pool.close();
    }
}

run();
