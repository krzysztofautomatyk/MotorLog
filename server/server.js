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
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        Zone AS name,
        COUNT(DISTINCT Line) AS lineCount,
        COUNT(DISTINCT MotorName) AS motorCount
      FROM dbo.MotorLogs
      WHERE Zone IS NOT NULL
      GROUP BY Zone
      ORDER BY Zone;
    `);
    res.json(result.recordset.map(r => ({ ...r, status: 'Healthy' })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/lines', async (req, res) => {
  const zone = req.query.zone;
  if (!zone) return res.status(400).json({ message: 'zone is required' });
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('zone', sql.NVarChar, zone);
    const result = await request.query(`
      SELECT 
        Line AS name,
        @zone AS zone,
        COUNT(DISTINCT MotorName) AS motorCount
      FROM dbo.MotorLogs
      WHERE Zone = @zone AND Line IS NOT NULL
      GROUP BY Line
      ORDER BY Line;
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/motors', async (req, res) => {
  const { zone, line } = req.query;
  if (!zone || !line) return res.status(400).json({ message: 'zone and line are required' });
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input('zone', sql.NVarChar, zone);
    request.input('line', sql.NVarChar, line);
    const result = await request.query(`
      SELECT DISTINCT MotorName
      FROM dbo.MotorLogs
      WHERE Zone = @zone AND Line = @line AND MotorName IS NOT NULL
      ORDER BY MotorName;
    `);
    res.json(result.recordset.map(r => r.MotorName));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/weeks', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT ProductionWeek
      FROM dbo.MotorLogs
      WHERE ProductionWeek IS NOT NULL
      ORDER BY ProductionWeek;
    `);
    res.json(result.recordset.map(r => r.ProductionWeek));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/motor-logs', async (req, res) => {
  const { zone, line, motor, weeks = '', day = 'ALL' } = req.query;
  if (!zone || !line || !motor) return res.status(400).json({ message: 'zone, line, motor are required' });

  const weekList = String(weeks).split(',').map(w => w.trim()).filter(Boolean);

  // Support multiple days: "1,3,5" or "ALL"
  const dayList = (String(day) === 'ALL' || !day)
    ? []
    : String(day).split(',').map(d => Number(d.trim())).filter(n => !Number.isNaN(n));

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
      // Use SQL DATEPART(WEEKDAY, ...) which depends on SET DATEFIRST
      // Assuming SET DATEFIRST 1 is used in query as seen below
      dayClause = `AND DATEPART(WEEKDAY, [Timestamp]) IN (${dayList.map((_, i) => `@day${i}`).join(',')})`;
      dayList.forEach((d, i) => request.input(`day${i}`, sql.Int, d));
    }

    const result = await request.query(`
      SET DATEFIRST 1;
      SELECT TOP (50000)
        [Id],
        -- Return timestamp as raw string to avoid timezone conversion by mssql driver
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
        ${weekClause}
        ${dayClause}
      ORDER BY [Timestamp] ASC;
    `);

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
