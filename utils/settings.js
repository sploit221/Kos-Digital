const { db } = require('../db/database');
const { defaultSettings } = require('../db/seed');

function parseValue(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return parseValue(row ? row.value : null, fallback);
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', 'localtime')`
  ).run(key, JSON.stringify(value));
}

function getSettings() {
  const settings = {};
  for (const key of Object.keys(defaultSettings)) {
    settings[key] = getSetting(key, defaultSettings[key]);
  }
  settings.rt_last_report = getSetting('rt_last_report', null);
  return settings;
}

function getPublicSettings() {
  const settings = getSettings();
  return {
    profile: settings.kos_profile,
    facilities: settings.facilities,
    locations: settings.locations,
    security: settings.security,
    rules: settings.rules,
    rules_note: settings.rules_note,
  };
}

function getRoomStats() {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS total FROM rooms GROUP BY status')
    .all();
  const stats = { total: 0, kosong: 0, terisi: 0, maintenance: 0 };
  for (const row of rows) {
    stats[row.status] = row.total;
    stats.total += row.total;
  }
  return stats;
}

function getRoomTypes() {
  return db
    .prepare(
      `SELECT room_type,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'kosong' THEN 1 ELSE 0 END) AS available,
              MIN(monthly_price) AS min_price,
              MAX(monthly_price) AS max_price
       FROM rooms
       GROUP BY room_type
       ORDER BY min_price ASC`
    )
    .all();
}

function getPublicSummary() {
  return {
    rooms: getRoomStats(),
    types: getRoomTypes(),
    settings: getPublicSettings(),
    generated_at: new Date().toISOString(),
  };
}

module.exports = {
  getSetting,
  setSetting,
  getSettings,
  getPublicSettings,
  getRoomStats,
  getRoomTypes,
  getPublicSummary,
};
