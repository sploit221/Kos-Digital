const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'kos-digital.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

const { ensureSeed } = require('./seed');
ensureSeed(db);

module.exports = { db, dbPath };
