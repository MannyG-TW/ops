/**
 * Run this script to apply migrations:
 *   npx tsx src/lib/db/migrate.ts
 *
 * For dev (SQLite), also auto-creates tables via drizzle-kit push.
 * For prod (Postgres/RDS), use drizzle-kit migrate with generated SQL files.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "ops.sqlite");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

const migrationsDir = path.join(process.cwd(), "drizzle");

if (fs.existsSync(migrationsDir)) {
  migrate(db, { migrationsFolder: migrationsDir });
  console.log("Migrations applied successfully.");
} else {
  console.log("No migrations folder found. Use 'npx drizzle-kit push' for dev setup.");
}

sqlite.close();
