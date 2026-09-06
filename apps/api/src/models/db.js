import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pool;

export async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'coffee',
      password: process.env.DB_PASSWORD || 'coffee_mvp_2026',
      database: process.env.DB_NAME || 'timquanhday',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function initDatabase() {
  const pool = await getPool();
  // Test connection
  await pool.query('SELECT 1');
  console.log('[DB] Connected to MySQL');
  
  // Run schema
  try {
    const schemaPath = join(__dirname, '../../../../database/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    // Split by statements and execute
    const statements = schema.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
    for (const stmt of statements) {
      if (stmt.trim().toUpperCase().startsWith('CREATE') || stmt.trim().toUpperCase().startsWith('ALTER')) {
        try { await pool.query(stmt); } catch (e) { /* ignore if exists */ }
      }
    }
    console.log('[DB] Schema initialized');
  } catch (e) {
    console.log('[DB] Schema file not found, using existing tables');
  }
}
