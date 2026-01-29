import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        requestTimeout: 300000 // 5 minutes for index creation
    }
};

async function applyIndexes() {
    let pool;
    try {
        console.log('Connecting to database...');
        pool = await sql.connect(config);
        console.log('Connected.');

        const sqlPath = path.join(__dirname, 'db-indexes.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Split by GO statements
        const batches = sqlContent
            .split(/\nGO\s*\n?/i)
            .map(b => b.trim())
            .filter(b => b.length > 0);

        console.log(`Found ${batches.length} batches to execute.`);

        for (let i = 0; i < batches.length; i++) {
            console.log(`Executing batch ${i + 1}/${batches.length}...`);
            try {
                await pool.request().query(batches[i]);
                console.log(`Batch ${i + 1} completed.`);
            } catch (err) {
                console.error(`Error in batch ${i + 1}:`, err.message);
                // Don't stop, some might fail if objects exist etc (though script handles it)
            }
        }

        console.log('Index application finished.');

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        if (pool) await pool.close();
    }
}

applyIndexes();
