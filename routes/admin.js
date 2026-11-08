const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getSettings,
  getSetting,
  setSetting,
  getRoomStats,
} = require('../utils/settings');
const { formatRupiah, todayMonth } = require('../utils/format');
const {
  cleanText,
  cleanMultiline,
  isValidNik,
  isValidPhone,
  isValidUsername,
  toInt,
  pick,
  normalizeUsername,
  safeHttpUrl,
} = require('../utils/validation');
const {
  buildReportData,
  buildReportText,
  buildRtPayload,
  buildPdfBuffer,
  getResidentYearOptions,
} = require('../utils/report');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

const ROOM_STATUSES = ['kosong', 'terisi', 'maintenance'];
const MAINTENANCE_STATUSES = ['pending', 'diproses', 'selesai'];

function redirectWith(res, path, type, message) {
  const key = type === 'error' ? 'error' : 'msg';
  const [base, hash] = path.split('#');
  const separator = base.includes('?') ? '&' : '?';
  const target = `${base}${separator}${key}=${encodeURIComponent(message)}`;
  return res.redirect(hash ? `${target}#${hash}` : target);
}

function currentMonthUnreported() {
  return db
    .prepare(
      `SELECT COUNT(*) AS total FROM users
       WHERE role = 'penghuni' AND reported_to_rt_at IS NULL
         AND strftime('%Y-%m', created_at) = ?`
    )
    .get(todayMonth()).total;
}

router.get('/', (req, res) => {
  const roomStats = getRoomStats();
  const residentCount = db
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'penghuni' AND is_active = 1")
    .get().total;
  const maintenanceRows = db
    .prepare("SELECT status, COUNT(*) AS total FROM maintenance GROUP BY status")
    .all();
  const maintenance = { pending: 0, diproses: 0, selesai: 0, total: 0 };
  for (const row of maintenanceRows) {
    maintenance[row.status] = row.total;
    maintenance.total += row.total;
  }

  const recentMaintenance = db
    .prepare(
      `SELECT m.*, u.name AS resident_name, r.room_number
       FROM maintenance m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN rooms r ON r.id = m.room_id
       ORDER BY m.created_at DESC, m.id DESC LIMIT 6`
    )
    .all();

  const recentResidents = db
    .prepare(
      `SELECT u.id, u.name, u.origin, u.created_at, u.reported_to_rt_at, r.room_number
       FROM users u LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.role = 'penghuni'
       ORDER BY u.created_at DESC, u.id DESC LIMIT 5`
    )
    .all();

  res.render('admin/dashboard', {
    title: 'Dashboard Admin',
    pageScript: 'admin.js',
    active: 'dashboard',
    roomStats,
    residentCount,
    maintenance,
    recentMaintenance,
    recentResidents,
    occupancy: roomStats.total ? Math.round((roomStats.terisi / roomStats.total) * 100) : 0,
    rtPending: currentMonthUnreported(),
    capacity: roomStats.total,
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
  res.render('admin/rooms', {
    title: 'Manajemen Kamar',
    pageScript: 'admin.js',
    active: 'rooms',
    rooms,
    stats: getRoomStats(),
    roomStatuses: ROOM_STATUSES,
  });
});

router.post('/rooms', (req, res) => {
  const roomNumber = cleanText(req.body.room_number, 12);
  const roomType = cleanText(req.body.room_type, 40) || 'Standard';
  const floor = toInt(req.body.floor, 1);
  const price = toInt(req.body.monthly_price, 0);
  const status = pick(req.body.status, ['kosong', 'maintenance'], 'kosong');
  const notes = cleanText(req.body.notes, 300);

  if (!roomNumber) {
    return redirectWith(res, '/admin/rooms', 'error', 'Nomor kamar wajib diisi.');
  }
  if (floor < 1 || floor > 50) {
    return redirectWith(res, '/admin/rooms', 'error', 'Lantai harus antara 1 dan 50.');
  }
  if (price < 0) {
    return redirectWith(res, '/admin/rooms', 'error', 'Harga sewa tidak boleh negatif.');
  }

  try {
    db.prepare(
      `INSERT INTO rooms (room_number, room_type, floor, monthly_price, status, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(roomNumber, roomType, floor, price, status, notes || null);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return redirectWith(res, '/admin/rooms', 'error', `Nomor kamar ${roomNumber} sudah terdaftar.`);
    }
    throw error;
  }
  return redirectWith(res, '/admin/rooms', 'success', `Kamar ${roomNumber} berhasil ditambahkan.`);
});

router.post('/rooms/:id/update', (req, res) => {
  const id = toInt(req.params.id);
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  if (!room) return redirectWith(res, '/admin/rooms', 'error', 'Kamar tidak ditemukan.');

  const occupant = db
    .prepare("SELECT id, name FROM users WHERE room_id = ? AND is_active = 1 AND role = 'penghuni'")
    .get(id);
  const roomType = cleanText(req.body.room_type, 40) || room.room_type;
  const floor = toInt(req.body.floor, room.floor);
  const price = toInt(req.body.monthly_price, room.monthly_price);
  const status = pick(req.body.status, ROOM_STATUSES, room.status);
  const notes = cleanText(req.body.notes, 300);

  if (floor < 1 || floor > 50) {
    return redirectWith(res, '/admin/rooms', 'error', 'Lantai harus antara 1 dan 50.');
  }
  if (occupant && status !== 'terisi') {
    return redirectWith(
      res,
      '/admin/rooms',
      'error',
      `Kamar ${room.room_number} masih dihuni oleh ${occupant.name}. Proses checkout terlebih dahulu.`
    );
  }
  if (!occupant && status === 'terisi') {
    return redirectWith(
      res,
      '/admin/rooms',
      'error',
      'Status terisi hanya dapat diatur melalui pendaftaran penghuni.'
    );
  }

  db.prepare(
    `UPDATE rooms SET room_type = ?, floor = ?, monthly_price = ?, status = ?, notes = ?,
       updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(roomType, floor, price, occupant ? 'terisi' : status, notes || null, id);

  return redirectWith(res, '/admin/rooms', 'success', `Kamar ${room.room_number} berhasil diperbarui.`);
});

router.post('/rooms/:id/delete', (req, res) => {
  const id = toInt(req.params.id);
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  if (!room) return redirectWith(res, '/admin/rooms', 'error', 'Kamar tidak ditemukan.');

  const occupant = db
    .prepare("SELECT id FROM users WHERE room_id = ? AND is_active = 1 AND role = 'penghuni'")
    .get(id);
  if (occupant) {
    return redirectWith(res, '/admin/rooms', 'error', 'Kamar masih dihuni dan tidak dapat dihapus.');
  }
  const reports = db.prepare('SELECT COUNT(*) AS total FROM maintenance WHERE room_id = ?').get(id).total;
  if (reports > 0) {
    return redirectWith(
      res,
      '/admin/rooms',
      'error',
      'Kamar memiliki riwayat laporan maintenance. Ubah status saja untuk menjaga riwayat.'
    );
  }

  db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
  return redirectWith(res, '/admin/rooms', 'success', `Kamar ${room.room_number} berhasil dihapus.`);
});

router.get('/residents', (req, res) => {
  const q = cleanText(req.query.q, 60);
  const like = `%${q}%`;
  const residents = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.nik, u.phone, u.origin, u.is_active,
              u.created_at, u.reported_to_rt_at, r.room_number, r.room_type
       FROM users u
       LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.role = 'penghuni'
         AND (? = '' OR u.name LIKE ? OR u.nik LIKE ? OR r.room_number LIKE ?)
       ORDER BY u.is_active DESC, u.created_at DESC, u.id DESC`
    )
    .all(q, like, like, like);

  const availableRooms = db
    .prepare("SELECT id, room_number, room_type, monthly_price FROM rooms WHERE status = 'kosong' ORDER BY room_number")
    .all();

  res.render('admin/residents', {
    title: 'Data Penghuni',
    pageScript: 'admin.js',
    active: 'residents',
    residents,
    availableRooms,
    q,
    stats: {
      active: db
        .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'penghuni' AND is_active = 1")
        .get().total,
      inactive: db
        .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'penghuni' AND is_active = 0")
        .get().total,
      unreported: db
        .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'penghuni' AND reported_to_rt_at IS NULL")
        .get().total,
    },
    formatRupiah,
  });
});

router.post('/residents', async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 80);
    const username = normalizeUsername(req.body.username);
    const password = cleanText(req.body.password, 128);
    const nik = cleanText(req.body.nik, 16);
    const phone = cleanText(req.body.phone, 20);
    const origin = cleanText(req.body.origin, 80);
    const roomId = toInt(req.body.room_id, 0);

    if (!name || !username || !password || !nik || !origin || !roomId) {
      return redirectWith(res, '/admin/residents', 'error', 'Semua kolom bertanda wajib harus diisi.');
    }
    if (!isValidUsername(username)) {
      return redirectWith(res, '/admin/residents', 'error', 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip (3-32 karakter).');
    }
    if (password.length < 6) {
      return redirectWith(res, '/admin/residents', 'error', 'Password minimal 6 karakter.');
    }
    if (!isValidNik(nik)) {
      return redirectWith(res, '/admin/residents', 'error', 'NIK harus terdiri dari 16 digit angka.');
    }
    if (phone && !isValidPhone(phone)) {
      return redirectWith(res, '/admin/residents', 'error', 'Format nomor telepon tidak valid.');
    }

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
    if (!room) return redirectWith(res, '/admin/residents', 'error', 'Kamar tidak ditemukan.');
    if (room.status !== 'kosong') {
      return redirectWith(res, '/admin/residents', 'error', `Kamar ${room.room_number} tidak tersedia.`);
    }

    const exists = db
      .prepare('SELECT id FROM users WHERE username = ? OR nik = ?')
      .get(username, nik);
    if (exists) {
      return redirectWith(res, '/admin/residents', 'error', 'Username atau NIK sudah terdaftar.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    db.exec('BEGIN');
    try {
      db.prepare(
        `INSERT INTO users (name, username, password_hash, role, nik, phone, origin, room_id)
         VALUES (?, ?, ?, 'penghuni', ?, ?, ?, ?)`
      ).run(name, username, passwordHash, nik, phone || null, origin, roomId);
      db.prepare(
        "UPDATE rooms SET status = 'terisi', updated_at = datetime('now', 'localtime') WHERE id = ?"
      ).run(roomId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE')) {
        return redirectWith(res, '/admin/residents', 'error', 'Username atau NIK sudah terdaftar.');
      }
      throw error;
    }

    return redirectWith(
      res,
      '/admin/residents',
      'success',
      `${name} berhasil terdaftar di kamar ${room.room_number}.`
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/residents/:id/checkout', (req, res) => {
  const id = toInt(req.params.id);
  const resident = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'penghuni' AND is_active = 1")
    .get(id);
  if (!resident) return redirectWith(res, '/admin/residents', 'error', 'Penghuni tidak ditemukan.');

  const roomId = resident.room_id;
  db.exec('BEGIN');
  try {
    db.prepare(
      "UPDATE users SET is_active = 0, room_id = NULL, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(id);
    if (roomId) {
      const remaining = db
        .prepare("SELECT COUNT(*) AS total FROM users WHERE room_id = ? AND is_active = 1")
        .get(roomId).total;
      if (remaining === 0) {
        db.prepare(
          "UPDATE rooms SET status = 'kosong', updated_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(roomId);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return redirectWith(res, '/admin/residents', 'success', `${resident.name} telah checkout.`);
});

router.post('/residents/:id/reset-password', async (req, res, next) => {
  try {
    const id = toInt(req.params.id);
    const password = cleanText(req.body.new_password, 128);
    const resident = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'penghuni'").get(id);
    if (!resident) return redirectWith(res, '/admin/residents', 'error', 'Penghuni tidak ditemukan.');
    if (password.length < 6) {
      return redirectWith(res, '/admin/residents', 'error', 'Password baru minimal 6 karakter.');
    }
    const hash = await bcrypt.hash(password, 10);
    db.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
    ).run(hash, id);
    return redirectWith(res, '/admin/residents', 'success', `Password ${resident.name} berhasil direset.`);
  } catch (error) {
    return next(error);
  }
});

router.get('/maintenance', (req, res) => {
  const status = pick(req.query.status, [...MAINTENANCE_STATUSES, 'all'], 'all');
  const rows = db
    .prepare(
      `SELECT m.*, u.name AS resident_name, u.phone, r.room_number
       FROM maintenance m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN rooms r ON r.id = m.room_id
       WHERE (? = 'all' OR m.status = ?)
       ORDER BY
         CASE m.status WHEN 'pending' THEN 0 WHEN 'diproses' THEN 1 ELSE 2 END,
         CASE m.priority WHEN 'tinggi' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END,
         m.created_at DESC`
    )
    .all(status, status);

  const statsRows = db.prepare('SELECT status, COUNT(*) AS total FROM maintenance GROUP BY status').all();
  const stats = { pending: 0, diproses: 0, selesai: 0, total: 0 };
  for (const row of statsRows) {
    stats[row.status] = row.total;
    stats.total += row.total;
  }

  res.render('admin/maintenance', {
    title: 'Laporan Maintenance',
    pageScript: 'admin.js',
    active: 'maintenance',
    reports: rows,
    status,
    stats,
  });
});

router.post('/maintenance/:id/status', (req, res) => {
  const id = toInt(req.params.id);
  const report = db.prepare('SELECT * FROM maintenance WHERE id = ?').get(id);
  if (!report) return redirectWith(res, '/admin/maintenance', 'error', 'Laporan tidak ditemukan.');

  const status = pick(req.body.status, MAINTENANCE_STATUSES, report.status);
  const adminNote = cleanMultiline(req.body.admin_note, 1000);
  const backStatus = pick(req.body.back_status, [...MAINTENANCE_STATUSES, 'all'], 'all');
  const completedAt = status === 'selesai' ? "datetime('now', 'localtime')" : 'NULL';

  db.prepare(
    `UPDATE maintenance
     SET status = ?, admin_note = ?, completed_at = ${completedAt},
         updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(status, adminNote || null, id);

  return redirectWith(
    res,
    `/admin/maintenance?status=${backStatus}`,
    'success',
    `Status laporan #${id} diperbarui menjadi ${status}.`
  );
});

router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    title: 'Pengaturan Kos',
    pageScript: 'admin.js',
    active: 'settings',
    settings: getSettings(),
  });
});

router.post('/settings', (req, res) => {
  const section = cleanText(req.body.section, 30);
  const current = getSettings();

  if (section === 'profile') {
    setSetting('kos_profile', {
      name: cleanText(req.body.name, 80) || current.kos_profile.name,
      tagline: cleanText(req.body.tagline, 160),
      address: cleanMultiline(req.body.address, 300),
      phone: cleanText(req.body.phone, 30),
      whatsapp: cleanText(req.body.whatsapp, 30),
      manager: cleanText(req.body.manager, 80),
      description: cleanMultiline(req.body.description, 1200),
    });
    return redirectWith(res, '/admin/settings#profil', 'success', 'Profil kos berhasil diperbarui.');
  }

  if (section === 'facilities') {
    const facilities = cleanMultiline(req.body.facilities, 3000)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 25)
      .map((line) => {
        const [name, ...rest] = line.split('|');
        return { name: cleanText(name, 60), description: cleanText(rest.join('|'), 180) };
      })
      .filter((item) => item.name);
    setSetting('facilities', facilities);
    return redirectWith(res, '/admin/settings#fasilitas', 'success', 'Daftar fasilitas berhasil diperbarui.');
  }

  if (section === 'locations') {
    const locations = cleanMultiline(req.body.locations, 6000)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 25)
      .map((line) => {
        const [name, category, ...rest] = line.split('|').map((part) => part.trim());
        const urlIndex = rest.findIndex((part) => /^https?:\/\//i.test(part));
        const accessParts = urlIndex >= 0 ? rest.slice(0, urlIndex) : rest;
        return {
          name: cleanText(name, 60),
          category: cleanText(category, 40) || 'Umum',
          access: cleanText(accessParts.filter(Boolean).join(' - '), 240),
          maps_url: safeHttpUrl(urlIndex >= 0 ? rest[urlIndex] : '', 600),
          photo_url: safeHttpUrl(
            urlIndex >= 0 ? rest.slice(urlIndex + 1).join('|') : '',
            1200
          ),
        };
      })
      .filter((item) => item.name);
    setSetting('locations', locations);
    return redirectWith(res, '/admin/settings#lokasi', 'success', 'Data akses lokasi berhasil diperbarui.');
  }

  if (section === 'security') {
    setSetting('security', {
      cctv_active: req.body.cctv_active === '1',
      cctv_count: Math.max(0, toInt(req.body.cctv_count, 0)),
      fingerprint: req.body.fingerprint === '1',
      gate_hours: cleanText(req.body.gate_hours, 160),
      patrol: cleanText(req.body.patrol, 200),
      notes: cleanMultiline(req.body.notes, 600),
    });
    return redirectWith(res, '/admin/settings#keamanan', 'success', 'Informasi keamanan berhasil diperbarui.');
  }

  if (section === 'rules') {
    const rules = cleanMultiline(req.body.rules, 4000)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((line) => {
        const [title, ...rest] = line.split('|');
        return { title: cleanText(title, 80), description: cleanText(rest.join('|'), 300) };
      })
      .filter((item) => item.title);
    setSetting('rules', rules);
    setSetting('rules_note', {
      visitor_hours: cleanText(req.body.visitor_hours, 80),
      curfew: cleanText(req.body.curfew, 80),
      late_penalty: cleanText(req.body.late_penalty, 80),
      damage_penalty: cleanText(req.body.damage_penalty, 120),
    });
    return redirectWith(res, '/admin/settings#aturan', 'success', 'Peraturan dan tata tertib berhasil diperbarui.');
  }

  return redirectWith(res, '/admin/settings', 'error', 'Bagian pengaturan tidak dikenal.');
});

router.get('/reports/rt', (req, res) => {
  const data = buildReportData(req.query.month);
  res.render('admin/report', {
    title: 'Laporan Warga ke RT',
    pageScript: 'admin.js',
    active: 'report',
    data,
    monthOptions: getResidentYearOptions(),
    lastReport: getSetting('rt_last_report', null),
  });
});

router.get('/reports/rt/print', (req, res) => {
  const data = buildReportData(req.query.month);
  res.render('admin/report-print', { title: 'Cetak Laporan Warga', data });
});

router.get('/reports/rt/download', (req, res) => {
  const data = buildReportData(req.query.month);
  const text = buildReportText(data);
  res.attachment(`laporan-warga-baru-${data.month}.txt`);
  res.type('text/plain; charset=utf-8');
  res.send(text);
});

router.get('/reports/rt/pdf', async (req, res, next) => {
  try {
    const data = buildReportData(req.query.month);
    const buffer = await buildPdfBuffer(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-warga-baru-${data.month}.pdf"`
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post('/reports/rt/send', async (req, res, next) => {
  try {
    const data = buildReportData(req.body.month);
    if (data.total === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Tidak ada penghuni baru pada periode ini untuk dilaporkan.',
      });
    }
    if (data.unreported === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Semua warga pada periode ini sudah dilaporkan ke RT.',
      });
    }

    const payload = buildRtPayload(data);
    await new Promise((resolve) => setTimeout(resolve, 450));

    const sentAt = new Date().toISOString();
    db.exec('BEGIN');
    try {
      const update = db.prepare(
        "UPDATE users SET reported_to_rt_at = datetime('now', 'localtime') WHERE id = ? AND role = 'penghuni'"
      );
      for (const resident of data.residents) update.run(resident.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const lastReport = {
      reference: payload.reference,
      month: data.month,
      month_label: data.month_label,
      total: data.total,
      sent_at: sentAt,
      endpoint: 'mock://rt-batam-center/v1/residents',
      status: 'terkirim',
    };
    setSetting('rt_last_report', lastReport);

    console.log(
      `[MOCK RT API] ${payload.reference} -> ${data.total} warga periode ${data.month} terkirim ke RT.`
    );

    return res.json({
      ok: true,
      message: `Laporan ${data.total} warga periode ${data.month_label} berhasil dikirim ke RT.`,
      reference: payload.reference,
      total: data.total,
      sent_at: sentAt,
      endpoint: lastReport.endpoint,
      payload_preview: payload.residents.slice(0, 3),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
