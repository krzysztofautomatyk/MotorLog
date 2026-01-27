import sql from 'mssql';
import dotenv from 'dotenv';

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
    enableKeepAlive: true,
    connectionTimeout: 30000
  }
};

async function testConnection() {
  try {
    console.log('🔍 Testing MSSQL connection...');
    console.log('Config:', { server: config.server, port: config.port, database: config.database });
    
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('✓ Connected!');

    // Check if table exists
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'
    `);
    console.log('📊 Tables in database:', tablesResult.recordset.map(r => r.TABLE_NAME));

    // Check MotorLogs data
    if (tablesResult.recordset.some(r => r.TABLE_NAME === 'MotorLogs')) {
      const dataResult = await pool.request().query('SELECT COUNT(*) as cnt FROM MotorLogs');
      console.log(`📈 Records in MotorLogs: ${dataResult.recordset[0].cnt}`);
      
      const zonesResult = await pool.request().query('SELECT DISTINCT Zone FROM MotorLogs');
      console.log('🏭 Zones:', zonesResult.recordset.map(r => r.Zone));
    }

    await pool.close();
    console.log('\n✓ All checks passed!');
  } catch (err) {
    console.error('✗ Error:', err.message);
    console.error(err);
  }
}

testConnection();
