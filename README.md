# Kos Digital

PWA pengelolaan kos berbasis Express dan SQLite. Terdiri dari halaman publik untuk calon penghuni, dashboard admin, dan portal penghuni untuk laporan maintenance.

## Fitur

- Halaman publik: ketersediaan kamar real-time, tipe kamar dan harga, fasilitas, akses lokasi, informasi keamanan, serta peraturan kos.
- Autentikasi JWT dengan cookie httpOnly, password bcrypt, rate limit login, dan pemeriksaan origin untuk permintaan POST.
- Dashboard admin: statistik hunian, manajemen kamar, pendaftaran/checkout penghuni, reset password, dan pengelolaan laporan maintenance.
- Portal penghuni: ringkasan kamar, kirim laporan kerusakan, lihat peraturan dan fasilitas, perbarui kontak, serta ganti password.
- Laporan warga baru ke RT: rekap per bulan, unduh teks, unduh PDF, halaman cetak, dan simulasi pengiriman ke API RT.
- PWA: manifest, service worker, ikon 192/512, halaman offline, dan tombol install.
- Pengaturan kos tersimpan di database (profil, fasilitas, lokasi, keamanan, aturan) dan dapat diubah dari dashboard admin.

## Teknologi

- Node.js 24+ (diuji pada Node 26) dengan modul bawaan `node:sqlite`
- Express 5, EJS, express-rate-limit, helmet, compression, cookie-parser
- bcryptjs, jsonwebtoken, pdfkit, dotenv
- Tailwind CSS Play CDN dan Plus Jakarta Sans

## Menjalankan

```bash
npm install
npm start
```

Buka `http://localhost:3000`. Server juga menampilkan alamat jaringan lokal saat dijalankan.

Database SQLite dibuat otomatis di `data/kos-digital.db`. Seed hanya membuat akun admin awal dan pengaturan dasar; data kamar, penghuni, serta maintenance dibiarkan kosong dan diisi melalui panel admin.

Pengaturan default menggunakan lokasi `Kawasan Batam Center, Kota Batam, Kepulauan Riau`. Nomor telepon, WhatsApp, dan nama pengelola sengaja dikosongkan sampai diisi melalui menu Pengaturan.

### Akun Awal

| Peran | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin123` |

Akun penghuni dibuat dari panel admin. Ganti password akun admin sebelum dipakai di lingkungan nyata.

## Environment

Salin `.env.example` menjadi `.env`, lalu atur nilainya.

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter
JWT_EXPIRES_IN=8h
APP_NAME=Kos Digital
```

`JWT_SECRET` wajib diisi saat `NODE_ENV=production`. Buat nilai acak dengan:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Variabel opsional:

- `HOST` (default `0.0.0.0`)
- `TRUST_PROXY=1` jika berjalan di belakang reverse proxy
- `DATABASE_PATH` untuk lokasi file database lain

## Perintah

```bash
npm start     # jalankan server
npm run dev   # jalankan dengan watch mode
npm run seed  # pastikan data awal tersedia
npm run icons # buat ulang ikon PNG PWA
```

## Struktur Proyek

```text
.
├── db/                 # skema, koneksi, dan data awal SQLite
├── middleware/         # autentikasi, otorisasi, error handler
├── public/             # aset statis, PWA, dan JavaScript klien
│   ├── icons/
│   ├── css/
│   ├── js/
│   ├── manifest.json
│   ├── service-worker.js
│   └── offline.html
├── routes/             # rute publik, auth, admin, penghuni
├── scripts/            # generator ikon PWA
├── utils/              # format, validasi, pengaturan, laporan
├── views/              # template EJS
├── server.js
└── package.json
```

## Rute Utama

| Metode | Path | Keterangan |
| --- | --- | --- |
| GET | `/` | Halaman publik |
| GET | `/api/public/summary` | Ringkasan kamar dan pengaturan publik |
| GET | `/api/admin/dashboard` | Statistik dashboard admin |
| GET | `/api/admin/rooms` | Data kamar untuk admin |
| GET | `/api/admin/residents` | Data penghuni untuk admin |
| GET | `/api/admin/maintenance` | Data maintenance untuk admin |
| GET | `/healthz` | Health check |
| GET/POST | `/login` | Masuk |
| POST | `/logout` | Keluar |
| GET | `/admin` | Dashboard admin |
| GET/POST | `/admin/rooms` | Daftar dan tambah kamar |
| GET/POST | `/admin/residents` | Daftar dan daftarkan penghuni |
| GET | `/admin/reports/rt` | Laporan warga baru ke RT |
| POST | `/admin/reports/rt/send` | Simulasi kirim laporan ke RT |
| GET | `/admin/reports/rt/pdf` | Unduh laporan PDF |
| GET | `/penghuni` | Dashboard penghuni |
| GET/POST | `/penghuni/maintenance` | Daftar dan kirim laporan kerusakan |

## Catatan PWA

- Service worker hanya didaftarkan pada HTTPS atau `localhost`/`127.0.0.1`, sesuai kebijakan browser.
- Akses melalui `http://IP-LAN:3000` tidak akan mengaktifkan service worker. Gunakan tunnel HTTPS atau reverse proxy dengan TLS untuk menguji PWA di perangkat lain.
- Halaman publik yang sudah dibuka disimpan di cache. Halaman admin dan penghuni tidak di-cache dan akan menampilkan `offline.html` saat tidak ada koneksi.
- Tailwind dimuat dari CDN sehingga tampilan halaman cache dapat berubah jika aset CDN belum tersedia di cache browser.

## Keamanan

- `helmet` mengaktifkan CSP; skrip pihak ketiga dibatasi ke Tailwind CDN dan Google Fonts.
- Cookie sesi `httpOnly`, `sameSite=lax`, dan `secure` pada production.
- Semua input teks dibersihkan dan dibatasi panjangnya. NIK divalidasi 16 digit.
- Login dibatasi 12 percobaan per 15 menit per alamat IP.
- Endpoint POST memeriksa header `Origin` bila dikirim browser.
- Aplikasi ini belum memiliki fitur ganti password admin. Untuk production, ganti kredensial admin awal langsung di database atau tambahkan alur administrasi yang sesuai.

## Reset Data

Hentikan server, hapus file database, lalu jalankan ulang:

```bash
rm -f data/kos-digital.db data/kos-digital.db-shm data/kos-digital.db-wal
npm start
```

Database baru akan berisi akun admin awal dan pengaturan default tanpa data kamar/penghuni. Jika hanya ingin memastikan data awal ada tanpa menghapus data lain, jalankan `npm run seed`.

## Integrasi RT

Pengiriman laporan saat ini memakai endpoint simulasi `mock://rt-batam-center/v1/residents` di `routes/admin.js`. Payload berisi data kos dan daftar warga baru (nama, NIK, kamar, asal, telepon, tanggal masuk). Untuk integrasi nyata, ganti bagian tersebut dengan pemanggilan HTTP ke API RT dan sesuaikan format payload serta autentikasinya.
