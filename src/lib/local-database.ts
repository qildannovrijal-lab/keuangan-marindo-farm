import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createLocalFarmData } from "@/lib/demo-data";
import type { FarmData } from "@/lib/domain";

const databasePath = resolve(process.env.MARINDO_DB_PATH || join(process.cwd(), ".data", "marindo.sqlite"));
mkdirSync(dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS farm_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const readStatement = database.prepare("SELECT data_json FROM farm_state WHERE id = 1");
const writeStatement = database.prepare(`
  INSERT INTO farm_state (id, data_json, updated_at)
  VALUES (1, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
`);

export function readFarmData(): FarmData {
  const record = readStatement.get() as { data_json: string } | undefined;
  if (!record) {
    const initial = createLocalFarmData();
    writeStatement.run(JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(record.data_json) as FarmData;
}

export function writeFarmData(data: FarmData) {
  writeStatement.run(JSON.stringify(data));
  return { saved: true, updatedAt: new Date().toISOString() };
}
