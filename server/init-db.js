import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Siemens123!',
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT || 2000),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectionTimeout: 30000
  }
};

// Sample motor data
const sampleData = [
  {"Id":1,"Timestamp":"2026-01-26 10:11:06.130","MotorID":6,"MotorName":"Motor 6","Zone":"DefaultZone","Line":"DefaultLine","ProductionWeek":"26W05","MaxCurrentLimit":7.50,"MotorCurrent":6.21,"IsMotorOn":1,"AvgCurrent":0.00,"RunningTime":10.00},
  {"Id":2,"Timestamp":"2026-01-26 10:11:06.413","MotorID":3,"MotorName":"Motor 3","Zone":"DefaultZone","Line":"DefaultLine","ProductionWeek":"26W05","MaxCurrentLimit":7.50,"MotorCurrent":5.95,"IsMotorOn":1,"AvgCurrent":0.00,"RunningTime":10.00},
  {"Id":3,"Timestamp":"2026-01-26 10:11:06.460","MotorID":11,"MotorName":"Motor 11","Zone":"DefaultZone","Line":"DefaultLine","ProductionWeek":"26W05","MaxCurrentLimit":7.50,"MotorCurrent":0.00,"IsMotorOn":1,"AvgCurrent":6.44,"RunningTime":99.00},
  {"Id":6,"Timestamp":"2026-01-26 10:11:06.500","MotorID":4,"MotorName":"Motor 4","Zone":"DefaultZone","Line":"DefaultLine","ProductionWeek":"26W05","MaxCurrentLimit":7.50,"MotorCurrent":0.00,"IsMotorOn":1,"AvgCurrent":6.42,"RunningTime":99.00},
  {"Id":9,"Timestamp":"2026-01-26 10:11:06.513","MotorID":2,"MotorName":"Motor 2","Zone":"DefaultZone","Line":"DefaultLine","ProductionWeek":"26W05","MaxCurrentLimit":7.50,"MotorCurrent":6.93,"IsMotorOn":1,"AvgCurrent":0.00,"RunningTime":10.00},
  {"Id":13,"Timestamp":"2026-01-26 10:11:06.986","MotorID":1,"MotorName":"Motor 1","Zone":"DefaultZone","Line":"DefaultLine","ProductionWeek":"26W05","MaxCurrentLimit":7.50,"MotorCurrent":5.95,"IsMotorOn":1,"AvgCurrent":0.00,"RunningTime":10.00}
];

async function initDatabase() {
  try {
    console.log('Connecting to MSSQL...');
    const config = {
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'Siemens123!',
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME || 'MotorLogDB',
      port: Number(process.env.DB_PORT || 2000),
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };

    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✓ Connected to MotorLogDB');

    // Clear old data
    console.log('Clearing old data...');
    await pool.request().query('DELETE FROM MotorLogs');

    // Insert sample data
    console.log('Inserting sample data...');
    for (const row of sampleData) {
      await pool.request()
        .input('id', sql.Int, row.Id)
        .input('timestamp', sql.DateTime2, row.Timestamp)
        .input('motorId', sql.Int, row.MotorID)
        .input('motorName', sql.NVarChar(50), row.MotorName)
        .input('zone', sql.NVarChar(50), row.Zone)
        .input('line', sql.NVarChar(50), row.Line)
        .input('week', sql.NVarChar(20), row.ProductionWeek)
        .input('maxCurrent', sql.Float, row.MaxCurrentLimit)
        .input('current', sql.Float, row.MotorCurrent)
        .input('isOn', sql.Bit, row.IsMotorOn)
        .input('avgCurrent', sql.Float, row.AvgCurrent)
        .input('runTime', sql.Float, row.RunningTime)
        .query(`
          INSERT INTO MotorLogs (
            Id, [Timestamp], MotorID, MotorName, Zone, Line, ProductionWeek,
            MaxCurrentLimit, MotorCurrent, IsMotorOn, AvgCurrent, RunningTime
          ) VALUES (
            @id, @timestamp, @motorId, @motorName, @zone, @line,
            @week, @maxCurrent, @current, @isOn, @avgCurrent, @runTime
          )
        `);
    }
    console.log('✓ Sample data inserted');

    // Verify
    const check = await pool.request().query('SELECT COUNT(*) as cnt FROM MotorLogs');
    console.log(`✓ Database ready: ${check.recordset[0].cnt} records\n`);

    await pool.close();
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

initDatabase();
