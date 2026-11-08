const express = require('express');
const { db } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getRoomStats } = require('../utils/settings');
const { todayMonth } = require('../utils/format');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function maintenanceStats() {
  const rows = db.prepare('SELECT status, COUNT(*) AS total FROM maintenance GROUP BY status').all();
  const stats = { pending: 0, diproses: 0, selesai: 0, total: 0 };
  for (const row of rows) {
    stats[row.status] = row.total;
    stats.total += row.total;
  }
  return stats;
}

function unreportedThisMonth() {
  return db
    .prepare(
      `SELECT COUNT(*) AS total FROM users
       WHERE role = 'penghuni' AND reported_to_rt_at IS NULL
         AND strftime('%Y-%m', created_at) = ?`
    )
    .get(todayMonth()).total;
}

router.get('/dashboard', (req, res) => {
  const roomStats = getRoomStats();
  const maintenance = maintenanceStats();
  const residentCount = db
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'penghuni' AND is_active = 1")
    .get().total;

  const recentResidents = db
    .prepare(
      `SELECT u.id, u.name, u.origin, u.created_at, u.reported_to_rt_at, r.room_number
       FROM users u LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.role = 'penghuni'
       ORDER BY u.created_at DESC, u.id DESC LIMIT 5`
    )
    .all();

  const recentMaintenance = db
    .prepare(
      `SELECT m.*, u.name AS resident_name, r.room_number
       FROM maintenance m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN rooms r ON r.id = m.room_id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 6`
    )
    .all();

  res.json({
    ok: true,
    data: {
      rooms: roomStats,
      occupancy: roomStats.total ? Math.round((roomStats.terisi / roomStats.total) * 100) : 0,
      resident_count: residentCount,
      maintenance,
      recent_residents: recentResidents,
      recent_maintenance: recentMaintenance,
      rt_pending: unreportedThisMonth(),
      generated_at: new Date().toISOString(),
    },
  });
});

router.get('/rooms', (req, res) => {
  const rooms = db
    .prepare(
      `SELECT r.*, u.id AS occupant_id, u.name AS occupant_name
       FROM rooms r
       LEFT JOIN users u ON u.room_id = r.id AND u.is_active = 1 AND u.role = 'penghuni'
       ORDER BY CAST(r.room_number AS INTEGER), r.room_number`
    )
    .all();
  res.json({ ok: true, data: { rooms, stats: getRoomStats() } });
});

router.get('/residents', (req, res) => {
  const residents = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.nik, u.phone, u.origin, u.is_active,
              u.created_at, u.reported_to_rt_at, r.room_number, r.room_type
       FROM users u
       LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.role = 'penghuni'
       ORDER BY u.is_active DESC, u.created_at DESC, u.id DESC`
    )
    .all();
  res.json({ ok: true, data: { residents } });
});

router.get('/maintenance', (req, res) => {
  const reports = db
    .prepare(
      `SELECT m.*, u.name AS resident_name, u.phone, r.room_number
       FROM maintenance m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN rooms r ON r.id = m.room_id
       ORDER BY m.created_at DESC, m.id DESC`
    )
    .all();
  res.json({ ok: true, data: { reports, stats: maintenanceStats() } });
});

module.exports = router;
