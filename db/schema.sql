PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL DEFAULT 'Standard',
  floor INTEGER NOT NULL DEFAULT 1,
  monthly_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'kosong' CHECK (status IN ('kosong', 'terisi', 'maintenance')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'penghuni' CHECK (role IN ('admin', 'penghuni')),
  nik TEXT UNIQUE,
  phone TEXT,
  origin TEXT,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  reported_to_rt_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'lainnya',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'sedang' CHECK (priority IN ('rendah', 'sedang', 'tinggi')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'diproses', 'selesai')),
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_room ON users(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_user ON maintenance(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_room ON maintenance(room_id);
