const jwt = require('jsonwebtoken');
const { db } = require('../db/database');

const COOKIE_NAME = 'kos_token';
const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '8h';
const JWT_SECRET = process.env.JWT_SECRET || 'kos-digital-development-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diatur pada environment production.');
}

function wantsJson(req) {
  return (
    req.path.startsWith('/api') ||
    req.xhr ||
    req.is('application/json') ||
    String(req.get('accept') || '').includes('application/json')
  );
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL, issuer: 'kos-digital' }
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

function findUserById(id) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.username, u.role, u.nik, u.phone, u.origin,
              u.room_id, u.is_active, u.reported_to_rt_at, u.created_at,
              r.room_number, r.room_type, r.status AS room_status,
              r.monthly_price
       FROM users u
       LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.id = ?`
    )
    .get(id);
}

function attachUser(req, res, next) {
  let token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  const authorization = req.get('authorization');
  if (!token && authorization && authorization.startsWith('Bearer ')) {
    token = authorization.slice(7);
  }

  req.user = null;
  res.locals.currentUser = null;

  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'kos-digital' });
    const user = findUserById(payload.sub);
    if (user && user.is_active) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      clearAuthCookie(res);
    }
  } catch {
    clearAuthCookie(res);
  }
  return next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  if (wantsJson(req)) {
    return res.status(401).json({ ok: false, message: 'Sesi tidak valid. Silakan login kembali.' });
  }
  const nextPath = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${nextPath}`);
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return requireAuth(req, res, next);
    if (req.user.role === role) return next();
    if (wantsJson(req)) {
      return res.status(403).json({ ok: false, message: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    return res.status(403).render('error', {
      status: 403,
      title: 'Akses Ditolak',
      message: 'Anda tidak memiliki izin untuk membuka halaman ini.',
    });
  };
}

function verifyOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host;
    if (originHost !== req.get('host')) {
      return res.status(403).json({ ok: false, message: 'Permintaan lintas situs ditolak.' });
    }
  } catch {
    return res.status(403).json({ ok: false, message: 'Origin permintaan tidak valid.' });
  }
  return next();
}

function redirectByRole(user) {
  return user.role === 'admin' ? '/admin' : '/penghuni';
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  attachUser,
  requireAuth,
  requireRole,
  verifyOrigin,
  wantsJson,
  redirectByRole,
  findUserById,
};
