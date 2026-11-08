const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db } = require('../db/database');
const {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  redirectByRole,
} = require('../middleware/auth');
const { cleanText, normalizeUsername } = require('../utils/validation');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) =>
    res.redirect(
      '/login?error=' +
        encodeURIComponent('Terlalu banyak percobaan login. Coba lagi dalam 15 menit.')
    ),
});

function getSafeNext(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(redirectByRole(req.user));
  return res.render('auth/login', {
    title: 'Masuk',
    showDemo: process.env.NODE_ENV !== 'production',
    error: req.query.error || null,
    next: getSafeNext(req.query.next) || '',
    username: '',
  });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = cleanText(req.body.password, 128);
    const safeNext = getSafeNext(req.body.next);

    if (!username || !password) {
      return res.status(400).render('auth/login', {
        title: 'Masuk',
        showDemo: process.env.NODE_ENV !== 'production',
        error: 'Username dan password wajib diisi.',
        next: safeNext || '',
        username,
      });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE username = ? AND is_active = 1')
      .get(username);

    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !valid) {
      return res.status(401).render('auth/login', {
        title: 'Masuk',
        showDemo: process.env.NODE_ENV !== 'production',
        error: 'Username atau password salah.',
        next: safeNext || '',
        username,
      });
    }

    setAuthCookie(res, signToken(user));
    return res.redirect(safeNext || redirectByRole(user));
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.redirect('/login?msg=' + encodeURIComponent('Anda telah keluar dengan aman.'));
});

module.exports = router;
