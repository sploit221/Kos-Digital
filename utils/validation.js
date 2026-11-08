function cleanText(value, maxLength = 500) {
  if (value == null) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 3000) {
  if (value == null) return '';
  return String(value)
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function isValidNik(value) {
  return /^\d{16}$/.test(String(value || ''));
}

function isValidPhone(value) {
  return /^[0-9+\-\s()]{8,20}$/.test(String(value || ''));
}

function isValidUsername(value) {
  return /^[a-zA-Z0-9._-]{3,32}$/.test(String(value || ''));
}

function isValidMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return false;
  const month = Number(String(value).split('-')[1]);
  return month >= 1 && month <= 12;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeUsername(value) {
  return cleanText(value, 32).toLowerCase();
}

function safeHttpUrl(value, maxLength = 1200) {
  const candidate = cleanText(value, maxLength);
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

module.exports = {
  cleanText,
  cleanMultiline,
  isValidNik,
  isValidPhone,
  isValidUsername,
  isValidMonth,
  toInt,
  pick,
  normalizeUsername,
  safeHttpUrl,
};
