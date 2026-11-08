const express = require('express');
const { getPublicSummary } = require('../utils/settings');

const router = express.Router();

router.get('/', (req, res) => {
  const summary = getPublicSummary();
  res.render('public/index', {
    title: 'Beranda',
    pageScript: 'public.js',
    summary,
    settings: summary.settings,
  });
});

router.get('/api/public/summary', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, data: getPublicSummary() });
});

router.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

module.exports = router;
