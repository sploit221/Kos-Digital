const bcrypt = require('bcryptjs');

const defaultSettings = {
  kos_profile: {
    name: 'Kos Digital Batam Center',
    tagline: 'Hunian nyaman, aman, dan terhubung digital.',
    address: 'Kawasan Batam Center, Kota Batam, Kepulauan Riau',
    phone: '',
    whatsapp: '',
    manager: '',
    description:
      'Kos Digital Batam Center adalah hunian modern dengan fasilitas lengkap, keamanan 24 jam, dan pengelolaan digital yang transparan. Cocok untuk mahasiswa dan pekerja yang membutuhkan tempat tinggal nyaman dekat pusat aktivitas di Batam Center.',
  },
  facilities: [
    { name: 'WiFi Gratis', description: 'Internet fiber 100 Mbps di seluruh area.' },
    { name: 'AC & Kipas', description: 'Setiap kamar dilengkapi pendingin ruangan.' },
    { name: 'Kamar Mandi Dalam', description: 'Kamar mandi pribadi dengan air panas.' },
    { name: 'Dapur Bersama', description: 'Dapur lengkap dengan kulkas dan alat masak.' },
    { name: 'Laundry', description: 'Layanan cuci setrika dengan biaya terjangkau.' },
    { name: 'Parkir Aman', description: 'Area parkir motor dan mobil dengan pengawasan.' },
    { name: 'Ruang Belajar', description: 'Ruang tenang untuk belajar dan bekerja.' },
    { name: 'Air Minum', description: 'Dispenser air minum gratis di setiap lantai.' },
  ],
  locations: [
    {
      name: 'Mega Mall Batam Centre',
      category: 'Pusat Perbelanjaan',
      access: '5 Menit berkendara - Pusat perbelanjaan utama di Batam Center.',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=Mega+Mall+Batam+Centre',
      photo_url:
        'https://lh3.googleusercontent.com/grass-cs/AABkmLd5WcAlxoOVy2fR8LozitWdGoxIa7zI3xrOmPF2J8QeHZ2yv60Ey3eEqs1UQTCTpQhKN0q2-uPIqJIqDoRzWe7wXimySTuUdUdSckmIrPmOmYnkJ-sB1_B-Qt0O0nZzTJTO-tUKYsAuJvSY=k-no',
    },
    {
      name: 'Pelabuhan Internasional Batam Centre',
      category: 'Transportasi',
      access:
        '7 Menit berkendara - Akses penyeberangan feri internasional ke Singapura dan Malaysia.',
      maps_url:
        'https://www.google.com/maps/search/?api=1&query=Pelabuhan+Internasional+Batam+Centre',
      photo_url: 'https://wikipedia.org',
    },
    {
      name: 'Dataran Engku Putri',
      category: 'Ruang Publik',
      access:
        '4 Menit berkendara - Ruang publik hijau, alun-alun kota, dan pusat kegiatan masyarakat.',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=Dataran+Engku+Putri+Batam',
      photo_url: 'https://zesthotel.com',
    },
    {
      name: 'Politeknik Negeri Batam',
      category: 'Pendidikan',
      access: '10 Menit berkendara - Kampus negeri vokasi utama di kawasan Batam Center.',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=Politeknik+Negeri+Batam',
      photo_url: 'https://polibatam.ac.id',
    },
  ],
  security: {
    cctv_active: true,
    cctv_count: 8,
    fingerprint: true,
    gate_hours: '06.00 - 23.00 (akses malam menggunakan kartu/fingerprint)',
    patrol: 'Patroli keamanan setiap 2 jam oleh petugas jaga',
    notes: 'Lingkungan berpagar, penerangan area parkir 24 jam, dan tombol darurat di setiap lantai.',
  },
  rules: [
    { title: 'Jam Kunjungan Tamu', description: 'Tamu hanya diperbolehkan berkunjung pukul 08.00 - 21.00 WIB. Tamu menginap wajib lapor ke pengelola.' },
    { title: 'Ketenangan Bersama', description: 'Dilarang membuat kebisingan setelah pukul 22.00 WIB. Gunakan earphone saat menonton atau bermusik.' },
    { title: 'Kebersihan', description: 'Penghuni wajib menjaga kebersihan kamar dan area bersama. Sampah dibuang pada tempat yang disediakan.' },
    { title: 'Keamanan', description: 'Penghuni wajib mengunci kamar saat meninggalkan kos dan tidak memberikan kunci kepada orang lain.' },
    { title: 'Denda Keterlambatan Sewa', description: 'Pembayaran sewa jatuh tempo setiap tanggal 5. Keterlambatan dikenakan denda Rp50.000 per hari.' },
    { title: 'Denda Kerusakan', description: 'Kerusakan fasilitas akibat kelalaian penghuni menjadi tanggung jawab penghuni sesuai biaya perbaikan.' },
    { title: 'Larangan', description: 'Dilarang membawa narkoba, senjata tajam, atau barang berbahaya. Dilarang merokok di dalam kamar.' },
  ],
  rules_note: {
    visitor_hours: '08.00 - 21.00 WIB',
    curfew: '23.00 WIB',
    late_penalty: 'Rp50.000 / hari',
    damage_penalty: 'Sesuai biaya perbaikan',
  },
};

const legacyProfile = {
  name: 'Kos Digital Emerald',
  address: 'Jl. Melati Raya No. 24, Kel. Sukamaju, Kec. Setiabudi, Jakarta Selatan',
  phone: '0812-3456-7890',
  whatsapp: '6281234567890',
  manager: 'Ibu Ratna',
  description:
    'Kos Digital Emerald adalah hunian modern dengan fasilitas lengkap, keamanan 24 jam, dan pengelolaan digital yang transparan. Cocok untuk mahasiswa dan pekerja yang membutuhkan tempat tinggal nyaman dekat pusat aktivitas.',
  rules_contact: '0812-3456-7890 (Ibu Ratna)',
};

const legacyDemoResidents = [
  { name: 'Budi Santoso', username: 'budi', nik: '3273010101010001' },
  { name: 'Sari Wulandari', username: 'sari', nik: '3273010101010002' },
  { name: 'Agus Pratama', username: 'agus', nik: '3273010101010003' },
  { name: 'Dewi Lestari', username: 'dewi', nik: '3273010101010004' },
  { name: 'Rizky Ramadhan', username: 'rizky', nik: '3273010101010005' },
  { name: 'Putri Anggraini', username: 'putri', nik: '3273010101010006' },
];

const legacyDemoRooms = [
  { number: '101', type: 'Standard', floor: 1, price: 850000 },
  { number: '102', type: 'Standard', floor: 1, price: 850000 },
  { number: '103', type: 'Standard', floor: 1, price: 850000 },
  { number: '104', type: 'Deluxe', floor: 1, price: 1100000 },
  { number: '105', type: 'Standard', floor: 1, price: 850000 },
  { number: '106', type: 'Standard', floor: 2, price: 900000 },
  { number: '107', type: 'Deluxe', floor: 2, price: 1150000 },
  { number: '108', type: 'Standard', floor: 2, price: 900000 },
  { number: '109', type: 'Standard', floor: 2, price: 900000 },
  { number: '110', type: 'Deluxe', floor: 2, price: 1150000 },
  { number: '111', type: 'Standard', floor: 3, price: 950000 },
  { number: '112', type: 'Premium', floor: 3, price: 1400000 },
];

function insertSettings(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insert.run(key, JSON.stringify(value));
  }
}

function migrateLegacySettings(db) {
  const profileRow = db.prepare("SELECT value FROM settings WHERE key = 'kos_profile'").get();
  if (profileRow) {
    try {
      const profile = JSON.parse(profileRow.value);
      let changed = false;
      for (const field of ['name', 'address', 'phone', 'whatsapp', 'manager', 'description']) {
        if (profile[field] === legacyProfile[field]) {
          profile[field] = defaultSettings.kos_profile[field];
          changed = true;
        }
      }
      if (changed) {
        db.prepare(
          "UPDATE settings SET value = ?, updated_at = datetime('now', 'localtime') WHERE key = 'kos_profile'"
        ).run(JSON.stringify(profile));
      }
    } catch {
      // ignore malformed legacy settings
    }
  }

  const rulesRow = db.prepare("SELECT value FROM settings WHERE key = 'rules_note'").get();
  if (rulesRow) {
    try {
      const rulesNote = JSON.parse(rulesRow.value);
      if (rulesNote.contact === legacyProfile.rules_contact) {
        delete rulesNote.contact;
        db.prepare(
          "UPDATE settings SET value = ?, updated_at = datetime('now', 'localtime') WHERE key = 'rules_note'"
        ).run(JSON.stringify(rulesNote));
      }
    } catch {
      // ignore malformed legacy settings
    }
  }
}

function cleanupLegacyDemoData(db) {
  const findResident = db.prepare(
    "SELECT id FROM users WHERE role = 'penghuni' AND username = ? AND nik = ? AND name = ?"
  );
  const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');

  let removed = 0;
  for (const resident of legacyDemoResidents) {
    const row = findResident.get(resident.username, resident.nik, resident.name);
    if (row) {
      deleteUser.run(row.id);
      removed += 1;
    }
  }

  if (removed === 0) return;

  const deleteRoom = db.prepare(
    'DELETE FROM rooms WHERE room_number = ? AND room_type = ? AND floor = ? AND monthly_price = ?'
  );
  for (const room of legacyDemoRooms) {
    deleteRoom.run(room.number, room.type, room.floor, room.price);
  }

  db.prepare(
    "UPDATE users SET phone = NULL WHERE username = 'admin' AND phone = '081200000000'"
  ).run();
}

function ensureAdmin(db) {
  const count = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'").get().total;
  if (count > 0) return;

  db.prepare(
    `INSERT INTO users (name, username, password_hash, role)
     VALUES (?, ?, ?, 'admin')`
  ).run('Administrator Kos', 'admin', bcrypt.hashSync('admin123', 10));
}

function ensureSeed(db) {
  insertSettings(db);
  migrateLegacySettings(db);
  cleanupLegacyDemoData(db);
  ensureAdmin(db);
}

module.exports = { ensureSeed, defaultSettings };

if (require.main === module) {
  const { db } = require('./database');
  ensureSeed(db);
  console.log('Database siap. Data dummy lama dibersihkan; hanya akun admin yang dipertahankan.');
  console.log('Admin: admin / admin123');
}
