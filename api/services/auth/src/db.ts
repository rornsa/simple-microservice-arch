import path from "path";
import { Database } from "sqlite3";
const sqlite3 = require('sqlite3').verbose();

let db: Database | null = null;

export function getDb() {
  if (db) return db;
  const dbPath = path.join(process.cwd(), "auth.db");
  db = new sqlite3.Database(dbPath);
  if (!db) throw new Error("Failed to open database");
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user'
    )
  `);

  return db;
}
