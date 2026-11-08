require('dotenv').config();

const path = require('node:path');
const os = require('node:os');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const { attachUser, verifyOrigin } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { db } = require('./db/database');
const format = require('./utils/format');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminApiRoutes = require('./routes/admin-api');
const penghuniRoutes = require('./routes/penghuni');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(cookieParser());
app.use(verifyOrigin);

app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: isProduction ? '7d' : 0,
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('service-worker.js') || filePath.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Service-Worker-Allowed', '/');
      }
    },
  })
);

app.use(attachUser);
app.use((req, res, next) => {
  if (req.user) res.setHeader('X-Kos-Auth', '1');
  next();
});
app.use((req, res, next) => {
  res.locals.flash = null;
  if (req.query.msg) {
    res.locals.flash = { type: 'success', message: String(req.query.msg).slice(0, 300) };
  } else if (req.query.error) {
    res.locals.flash = { type: 'error', message: String(req.query.error).slice(0, 300) };
  }
  res.locals.currentPath = req.path;
  res.locals.currentYear = new Date().getFullYear();
  next();
});

Object.assign(app.locals, format, {
  appName: 'Kos Digital',
  appTagline: 'Hunian nyaman, aman, dan terhubung digital.',
});

app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/api/admin', adminApiRoutes);
app.use('/admin', adminRoutes);
app.use('/penghuni', penghuniRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╭──────────────────────────────────────────────╮');
  console.log('  │            KOS DIGITAL - PWA SERVER          │');
  console.log('  ╰──────────────────────────────────────────────╯');
  console.log(`  Lokal   : http://localhost:${PORT}`);
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`  Jaringan: http://${address.address}:${PORT}`);
      }
    }
  }
  console.log('');
  console.log('  Admin    : admin / admin123');
  console.log('  Penghuni : daftarkan melalui panel admin');
  console.log('');
});

function shutdown(signal) {
  console.log(`\n${signal} diterima, menutup server...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
