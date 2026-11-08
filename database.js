const sqlite3 = require('sqlite3').verbose();

// Menggunakan ':memory:' agar Vercel tidak memunculkan error penulisan file fisik
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) console.error('Gagal koneksi database:', err.message);
    else console.log('Terhubung ke database SQLite In-Memory untuk Vercel.');
});

db.serialize(() => {
    // Tabel Kamar (Rooms)
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        price INTEGER NOT NULL,
        status TEXT DEFAULT 'Kosong'
    )`);

    // Tabel Penyewa (Tenants)
    db.run(`CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        room_id INTEGER,
        join_date TEXT,
        due_date TEXT,
        FOREIGN KEY(room_id) REFERENCES rooms(id)
    )`);

    // Tabel Maintenance
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_name TEXT,
        room_number TEXT,
        issue TEXT,
        category TEXT,
        priority TEXT,
        status TEXT DEFAULT 'Pending',
        date TEXT
    )`);

    // Mengisi 12 Kamar secara otomatis ke memori RAM Vercel agar tidak kosong
    db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
        if (!err && row.count === 0) {
            const stmt = db.prepare("INSERT INTO rooms (room_number, type, price, status) VALUES (?, ?, ?, ?)");
            for (let i = 101; i <= 112; i++) {
                let type = i <= 104 ? 'Standard' : (i <= 108 ? 'Deluxe' : 'Premium');
                let price = type === 'Standard' ? 850000 : (type === 'Deluxe' ? 1100000 : 1400000);
                let status = i % 2 === 0 ? 'Terisi' : 'Kosong'; // Default terisi acak untuk simulasi awal
                stmt.run(`Kamar ${i}`, type, price, status);
            }
            stmt.finalize();
            console.log("12 Kamar default berhasil dimasukkan ke memori server.");
        }
    });
});

module.exports = db;
