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

const commands = [
    `IF OBJECT_ID('dbo.V_MotorHierarchy', 'V') IS NOT NULL DROP VIEW dbo.V_MotorHierarchy`,

    `CREATE VIEW dbo.V_MotorHierarchy
    WITH SCHEMABINDING
    AS
    SELECT 
        Zone, 
        Line, 
        MotorName, 
        COUNT_BIG(*) AS LogCount
    FROM dbo.MotorLogs
    WHERE Zone IS NOT NULL 
      AND Line IS NOT NULL 
      AND MotorName IS NOT NULL
    GROUP BY Zone, Line, MotorName`,

    `CREATE UNIQUE CLUSTERED INDEX IX_V_MotorHierarchy 
    ON dbo.V_MotorHierarchy (Zone, Line, MotorName)`
];

async function run() {
    let pool;
    try {
        console.log('Connecting...');
        pool = await sql.connect(config);
        console.log('Connected.');

        for (let i = 0; i < commands.length; i++) {
            console.log(`Running command ${i + 1}/${commands.length}...`);
            try {
                await pool.request().query(commands[i]);
                console.log(`Success.`);
            } catch (e) {
                console.error(`Error in command ${i + 1}:`, e.message);
                throw e;
            }
        }
        console.log('Done.');
    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        if (pool) await pool.close();
    }
}

run();
