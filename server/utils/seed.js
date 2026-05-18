const fs = require('fs');
const path = require('path');
const mysql2 = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbName = process.env.DB_NAME || 'healthcare_db';
const sqlPath = process.env.SEED_SQL_PATH || path.resolve(__dirname, '../../../../sample_data.sql');

async function runSeed() {
  if (!fs.existsSync(sqlPath)) {
    console.error(`Seed file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const rootConn = await mysql2.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await rootConn.end();

  const dbConn = await mysql2.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true
  });

  await dbConn.query(sql);
  await dbConn.end();

  console.log(`Seed data loaded into ${dbName}`);
}

runSeed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
