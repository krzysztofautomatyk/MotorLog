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
        requestTimeout: 300000
    }
};

async function applyView() {
    let pool;
    try {
        console.log('Connecting to database...');
        pool = await sql.connect(config);
        console.log('Connected.');

        const sqlPath = path.join(__dirname, 'db-view.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // Foolproof manual splitting
        const batches = sqlContent
            .split(/\r?\n/)
            .reduce((acc, line) => {
                if (line.trim().toUpperCase() === 'GO') {
                    acc.push([]); // Start new batch
                } else {
                    if (acc.length === 0) acc.push([]);
                    acc[acc.length - 1].push(line);
                }
                return acc;
            }, [])
            .map(lines => lines.join('\n'))
            .filter(b => b.trim().length > 0);

        console.log(`Found ${batches.length} batches to execute.`);

        for (let i = 0; i < batches.length; i++) {
            console.log(`Executing batch ${i + 1}/${batches.length}...`);
            await pool.request().query(batches[i]);
            console.log(`Batch ${i + 1} completed.`);
        }

        console.log('View creation finished.');

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        if (pool) await pool.close();
    }
}

applyView();
