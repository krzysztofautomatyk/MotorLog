import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Siemens123!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'MotorLogDB',
  port: Number(process.env.DB_PORT || 2000),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

let poolPromise;
const getPool = async () => {
  if (!poolPromise) {
    poolPromise = sql.connect(config).catch(err => {
      console.error('Database connection error:', err.message);
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
};

// Lightweight metadata cache (zones/lines/motors/weeks) to avoid repeated aggregates
const metadataCache = new Map();
const inFlight = new Map();
const TTL = {
  zones: Number(process.env.METADATA_TTL_ZONES_MS || 60_000),
  lines: Number(process.env.METADATA_TTL_LINES_MS || 30_000),
  motors: Number(process.env.METADATA_TTL_MOTORS_MS || 30_000),
  weeks: Number(process.env.METADATA_TTL_WEEKS_MS || 300_000)
};

const getCached = async (key, ttl, fetcher) => {
  const now = Date.now();
  const hit = metadataCache.get(key);
  if (hit && hit.expires > now) return hit.value;

  // Deduplicate concurrent fetches for same key
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      const value = await fetcher();
      metadataCache.set(key, { value, expires: now + ttl });
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
};

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/zones', async (_req, res) => {
  try {
    const zones = await getCached('zones', TTL.zones, async () => {
      const pool = await getPool();
      // FAST: Use Indexed View V_MotorHierarchy
      const result = await pool.request().query(`
        SELECT 
          Zone AS name,
          COUNT(DISTINCT Line) AS lineCount,
          COUNT(DISTINCT MotorName) AS motorCount
        FROM dbo.V_MotorHierarchy WITH (NOEXPAND)
        GROUP BY Zone
        ORDER BY Zone;
      `);
      return result.recordset.map(r => ({ ...r, status: 'Healthy' }));
    });

    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/lines', async (req, res) => {
  const zone = req.query.zone;
  if (!zone) return res.status(400).json({ message: 'zone is required' });
  try {
    const lines = await getCached(`lines:${zone}`, TTL.lines, async () => {
      const pool = await getPool();
      const request = pool.request();
      request.input('zone', sql.NVarChar, zone);
      // FAST: Use Indexed View V_MotorHierarchy
      const result = await request.query(`
        SELECT 
          Line AS name,
          @zone AS zone,
          COUNT(DISTINCT MotorName) AS motorCount
        FROM dbo.V_MotorHierarchy WITH (NOEXPAND)
        WHERE Zone = @zone
        GROUP BY Line
        ORDER BY Line;
      `);
      return result.recordset;
    });

    res.json(lines);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/motors', async (req, res) => {
  const { zone, line } = req.query;
  if (!zone || !line) return res.status(400).json({ message: 'zone and line are required' });
  try {
    const motors = await getCached(`motors:${zone}:${line}`, TTL.motors, async () => {
      const pool = await getPool();
      const request = pool.request();
      request.input('zone', sql.NVarChar, zone);
      request.input('line', sql.NVarChar, line);
      // FAST: Use Indexed View V_MotorHierarchy
      const result = await request.query(`
        SELECT MotorName
        FROM dbo.V_MotorHierarchy WITH (NOEXPAND)
        WHERE Zone = @zone AND Line = @line
        ORDER BY MotorName;
      `);
      return result.recordset.map(r => r.MotorName);
    });

    res.json(motors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/weeks', async (_req, res) => {
  try {
    const weeks = await getCached('weeks', TTL.weeks, async () => {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT DISTINCT ProductionWeek
        FROM dbo.MotorLogs
        WHERE ProductionWeek IS NOT NULL
        ORDER BY ProductionWeek;
      `);
      return result.recordset.map(r => r.ProductionWeek);
    });

    res.json(weeks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/motor-logs', async (req, res) => {
  const { zone, line, motor, weeks = '', day = 'ALL', limit = '5000' } = req.query;
  if (!zone || !line || !motor) return res.status(400).json({ message: 'zone, line, motor are required' });

  const weekList = String(weeks).split(',').map(w => w.trim()).filter(Boolean);
  const dayList = (String(day) === 'ALL' || !day)
    ? []
    : String(day).split(',').map(d => Number(d.trim())).filter(n => !Number.isNaN(n));

  const targetPoints = Math.max(100, Math.min(Number(limit) || 5000, 20000));

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('zone', sql.NVarChar, zone);
    request.input('line', sql.NVarChar, line);
    request.input('motor', sql.NVarChar, motor);

    let weekClause = '';
    if (weekList.length > 0) {
      weekClause = `AND ProductionWeek IN (${weekList.map((_, i) => `@week${i}`).join(',')})`;
      weekList.forEach((w, i) => request.input(`week${i}`, sql.NVarChar, w));
    }

    let dayClause = '';
    if (dayList.length > 0) {
      dayClause = `AND DATEPART(WEEKDAY, [Timestamp]) IN (${dayList.map((_, i) => `@day${i}`).join(',')})`;
      dayList.forEach((d, i) => request.input(`day${i}`, sql.Int, d));
    }

    // Smart Sampling Query (LTTB-lite):
    // 1. Always include State Changes (IsMotorOn transitions) to keep step charts perfect.
    // 2. Divide time into buckets and pick Min/Max current to keep spikes visible.

    // Using dynamic SQL construction for the sampling part
    // If TotalCount <= limit, we return everything (fast path).
    // If > limit, we execute the smart sampling.

    // We used to use a simple CTE with RowNum % Step, but that loses peaks and state changes.
    // New strategy:
    // A) Calculate Bucket Size (TotalDuration / Limit)
    // B) Group by Bucket
    // C) Select MAX(Current) per bucket, MIN(Current) per bucket
    // D) Select ALL rows where IsMotorOn changes

    // Smart Sampling Query (LTTB-lite):
    // REWRITE: Using Temp Table because CTEs cannot be reused across multiple statements (Count, then Limits, then Selection).

    // Smart Sampling Query (Strict Min/Max/First):
    // 1. Strict limit on points per bucket (Min, Max, First) to prevent data explosion on steady states.
    // 2. High fidelity: Retains peaks, valleys, and state changes.

    // We target 3 points per bucket (First, Min, Max) + State Changes.
    // So effective buckets = limit / 3.

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
            [Id], [Timestamp], [MotorName], [MotorCurrent], [IsMotorOn], [PrevState],
            CAST( DATEDIFF(SECOND, @StartTime, [Timestamp]) / (@DurationSeconds / @Buckets) AS INT) as BucketId
          FROM #FilteredData
      ),
      Ranked AS (
          SELECT 
             *,
             ROW_NUMBER() OVER (PARTITION BY BucketId ORDER BY MotorCurrent ASC) as RankMin,
             ROW_NUMBER() OVER (PARTITION BY BucketId ORDER BY MotorCurrent DESC) as RankMax,
             ROW_NUMBER() OVER (PARTITION BY BucketId ORDER BY [Timestamp] ASC) as RankFirst
          FROM Bucketed
      ),
      SelectedIds AS (
          -- 1. State Changes
          SELECT [Id] FROM Bucketed WHERE CAST([IsMotorOn] AS INT) <> PrevState
          
          UNION
          
          -- 2. First point of bucket
          SELECT [Id] FROM Ranked WHERE RankFirst = 1
          
          UNION
          
          -- 3. Max Current
          SELECT [Id] FROM Ranked WHERE RankMax = 1
          
          UNION

          -- 4. Min Current
          SELECT [Id] FROM Ranked WHERE RankMin = 1
      )
      SELECT 
        T.[Id],
        FORMAT(T.[Timestamp], 'yyyy-MM-dd HH:mm:ss.fff') AS [Timestamp],
        T.[MotorName],
        T.[Zone],
        T.[Line],
        T.[ProductionWeek],
        T.[MaxCurrentLimit],
        T.[MotorCurrent],
        T.[IsMotorOn],
        T.[AvgCurrent],
        T.[RunningTime]
      FROM #FilteredData T
      WHERE T.[Id] IN (SELECT [Id] FROM SelectedIds)
      ORDER BY T.[Timestamp] ASC
      OPTION (RECOMPILE);
      
      DROP TABLE #FilteredData;
    `;

    const result = await request.query(query);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Endpoint for auto-refresh mode - returns only last 15 minutes of data
app.get('/api/motor-logs-latest', async (req, res) => {
  const { zone, line, motor, minutes = 15 } = req.query;
  if (!zone || !line || !motor) return res.status(400).json({ message: 'zone, line, motor are required' });

  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('zone', sql.NVarChar, zone);
    request.input('line', sql.NVarChar, line);
    request.input('motor', sql.NVarChar, motor);
    request.input('minutes', sql.Int, Number(minutes) || 15);

    const result = await request.query(`
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
      FROM [dbo].[MotorLogs]
      WHERE [MotorName] = @motor
        AND [Zone] = @zone
        AND [Line] = @line
        AND [Timestamp] >= DATEADD(MINUTE, -@minutes, GETDATE())
      ORDER BY [Timestamp] ASC;
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const port = Number(process.env.API_PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
