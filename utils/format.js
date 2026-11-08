const monthNames = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function toDate(value) {
  if (value instanceof Date) return value;
  if (value == null || value === '') return null;
  const normalized = String(value).includes('T')
    ? String(value)
    : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRupiah(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(number);
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMonth(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value || '-';
  const [year, month] = value.split('-').map(Number);
  return `${monthNames[month - 1]} ${year}`;
}

function todayMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

const statusLabels = {
  pending: 'Pending',
  diproses: 'Diproses',
  selesai: 'Selesai',
};

const roomStatusLabels = {
  kosong: 'Kosong',
  terisi: 'Terisi',
  maintenance: 'Maintenance',
};

const priorityLabels = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
};

function statusLabel(status) {
  return statusLabels[status] || status || '-';
}

function roomStatusLabel(status) {
  return roomStatusLabels[status] || status || '-';
}

function priorityLabel(priority) {
  return priorityLabels[priority] || priority || '-';
}

const badgeClasses = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  diproses: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20',
  selesai: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  kosong: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  terisi: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20',
  maintenance: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  rendah: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10',
  sedang: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  tinggi: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
};

function badgeClass(value) {
  return badgeClasses[value] || 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10';
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function maskNik(nik) {
  if (!nik) return '-';
  const value = String(nik);
  if (value.length < 8) return value;
  return `${value.slice(0, 4)}${'*'.repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`;
}

module.exports = {
  formatRupiah,
  formatDate,
  formatDateTime,
  formatMonth,
  todayMonth,
  initials,
  statusLabel,
  roomStatusLabel,
  priorityLabel,
  badgeClass,
  greeting,
  maskNik,
  monthNames,
};
