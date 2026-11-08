const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSettings, getSetting } = require('../utils/settings');
const { cleanText, cleanMultiline, isValidPhone, pick } = require('../utils/validation');

const router = express.Router();

router.use(requireAuth, requireRole('penghuni'));

const CATEGORIES = ['AC', 'Listrik', 'Lampu', 'Air', 'Kamar Mandi', 'Pintu/Jendela', 'WiFi', 'Furnitur', 'Lainnya'];
const PRIORITIES = ['rendah', 'sedang', 'tinggi'];

function redirectWith(res, path, type, message) {
  const key = type === 'error' ? 'error' : 'msg';
  const separator = path.includes('?') ? '&' : '?';
  return res.redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

function getMyReports(userId, limit = null) {
  const sql = `SELECT * FROM maintenance WHERE user_id = ? ORDER BY created_at DESC, id DESC`;
  return limit
    ? db.prepare(`${sql} LIMIT ?`).all(userId, limit)
    : db.prepare(sql).all(userId);
}

function reportStats(userId) {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS total FROM maintenance WHERE user_id = ? GROUP BY status')
    .all(userId);
  const stats = { pending: 0, diproses: 0, selesai: 0, total: 0 };
  for (const row of rows) {
    stats[row.status] = row.total;
    stats.total += row.total;
  }
  return stats;
}

router.get('/', (req, res) => {
  const rulesNote = getSetting('rules_note', {});
  const profile = getSetting('kos_profile', {});
  const recentReports = getMyReports(req.user.id, 4);
  res.render('penghuni/dashboard', {
    title: 'Dashboard Penghuni',
    pageScript: 'penghuni.js',
    active: 'dashboard',
    stats: reportStats(req.user.id),
    recentReports,
    rulesNote,
    profile,
    security: getSetting('security', {}),
  });
});

router.get('/maintenance', (req, res) => {
  res.render('penghuni/maintenance', {
    title: 'Lapor Kerusakan',
    pageScript: 'penghuni.js',
    active: 'maintenance',
    reports: getMyReports(req.user.id),
    stats: reportStats(req.user.id),
    categories: CATEGORIES,
    priorities: PRIORITIES,
  });
});

router.post('/maintenance', (req, res) => {
  const category = pick(req.body.category, CATEGORIES, 'Lainnya');
  const title = cleanText(req.body.title, 120);
  const description = cleanMultiline(req.body.description, 2000);
  const priority = pick(req.body.priority, PRIORITIES, 'sedang');

  if (title.length < 5) {
    return redirectWith(res, '/penghuni/maintenance', 'error', 'Judul laporan minimal 5 karakter.');
  }
  if (description.length < 10) {
    return redirectWith(res, '/penghuni/maintenance', 'error', 'Deskripsi kerusakan minimal 10 karakter.');
  }
  if (!req.user.room_id) {
    return redirectWith(res, '/penghuni/maintenance', 'error', 'Kamar Anda belum terhubung. Hubungi pengelola.');
  }

  db.prepare(
    `INSERT INTO maintenance (user_id, room_id, category, title, description, priority)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, req.user.room_id, category, title, description, priority);

  return redirectWith(
    res,
    '/penghuni/maintenance',
    'success',
    'Laporan kerusakan berhasil dikirim. Pengelola akan segera menindaklanjuti.'
  );
});

router.get('/rules', (req, res) => {
  const settings = getSettings();
  res.render('penghuni/rules', {
    title: 'Peraturan & Fasilitas',
    pageScript: 'penghuni.js',
    active: 'rules',
    settings,
  });
});

router.get('/profile', (req, res) => {
  res.render('penghuni/profile', {
    title: 'Profil Saya',
    pageScript: 'penghuni.js',
    active: 'profile',
    profile: req.user,
  });
});

router.post('/profile/contact', (req, res) => {
  const phone = cleanText(req.body.phone, 20);
  if (phone && !isValidPhone(phone)) {
    return redirectWith(res, '/penghuni/profile', 'error', 'Format nomor telepon tidak valid.');
  }
  db.prepare(
    "UPDATE users SET phone = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(phone || null, req.user.id);
  return redirectWith(res, '/penghuni/profile', 'success', 'Nomor telepon berhasil diperbarui.');
});

router.post('/profile/password', async (req, res, next) => {
  try {
    const currentPassword = cleanText(req.body.current_password, 128);
    const newPassword = cleanText(req.body.new_password, 128);
    const confirmPassword = cleanText(req.body.confirm_password, 128);

    if (!currentPassword || !newPassword) {
      return redirectWith(res, '/penghuni/profile', 'error', 'Semua kolom password wajib diisi.');
    }
    if (newPassword.length < 6) {
      return redirectWith(res, '/penghuni/profile', 'error', 'Password baru minimal 6 karakter.');
    }
    if (newPassword !== confirmPassword) {
      return redirectWith(res, '/penghuni/profile', 'error', 'Konfirmasi password baru tidak cocok.');
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return redirectWith(res, '/penghuni/profile', 'error', 'Password saat ini salah.');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(hash, req.user.id);
    return redirectWith(res, '/penghuni/profile', 'success', 'Password berhasil diperbarui.');
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
