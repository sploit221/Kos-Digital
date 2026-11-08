function isApiRequest(req) {
  return (
    req.path.startsWith('/api') ||
    req.xhr ||
    req.is('application/json') ||
    String(req.get('accept') || '').includes('application/json')
  );
}

function notFound(req, res) {
  if (isApiRequest(req)) {
    return res.status(404).json({ ok: false, message: 'Endpoint tidak ditemukan.' });
  }
  return res.status(404).render('error', {
    status: 404,
    title: 'Halaman Tidak Ditemukan',
    message: 'Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.',
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error('[ERROR]', error);
  if (isApiRequest(req)) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status && error.status < 500 ? error.message : 'Terjadi kesalahan pada server.',
    });
  }
  return res.status(error.status || 500).render('error', {
    status: error.status || 500,
    title: 'Terjadi Kesalahan',
    message:
      error.status && error.status < 500
        ? error.message
        : 'Terjadi kesalahan pada server. Silakan coba kembali beberapa saat lagi.',
  });
}

module.exports = { notFound, errorHandler };
