const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'neon', 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Neon schema is ready.');
  } finally {
    await pool.end();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
