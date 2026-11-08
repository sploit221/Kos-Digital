const PDFDocument = require('pdfkit');
const { db } = require('../db/database');
const { getSetting } = require('./settings');
const { formatDate, formatMonth, todayMonth } = require('./format');

function getResidentsByMonth(month) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.nik, u.origin, u.phone, u.created_at, u.reported_to_rt_at,
              r.room_number
       FROM users u
       LEFT JOIN rooms r ON r.id = u.room_id
       WHERE u.role = 'penghuni' AND strftime('%Y-%m', u.created_at) = ?
       ORDER BY u.created_at ASC, r.room_number ASC`
    )
    .all(month);
}

function getResidentYearOptions() {
  return db
    .prepare(
      `SELECT DISTINCT strftime('%Y-%m', created_at) AS month
       FROM users
       WHERE role = 'penghuni'
       ORDER BY month DESC`
    )
    .all()
    .map((row) => row.month)
    .filter(Boolean);
}

function normalizeMonth(value) {
  const candidate = String(value || '');
  const month = Number(candidate.split('-')[1]);
  return /^\d{4}-\d{2}$/.test(candidate) && month >= 1 && month <= 12
    ? candidate
    : todayMonth();
}

function buildReportData(monthInput) {
  const month = normalizeMonth(monthInput);
  const profile = getSetting('kos_profile', {});
  const residents = getResidentsByMonth(month);
  return {
    month,
    month_label: formatMonth(month),
    profile,
    residents,
    total: residents.length,
    unreported: residents.filter((resident) => !resident.reported_to_rt_at).length,
    generated_at: new Date(),
  };
}

function buildReportText(data) {
  const line = '='.repeat(78);
  const thin = '-'.repeat(78);
  const rows = data.residents.map((resident, index) => {
    const number = String(index + 1).padStart(2, '0');
    const name = String(resident.name || '-').slice(0, 22).padEnd(22, ' ');
    const nik = String(resident.nik || '-').padEnd(18, ' ');
    const room = String(resident.room_number || '-').padEnd(6, ' ');
    const origin = String(resident.origin || '-').slice(0, 16).padEnd(16, ' ');
    const date = formatDate(resident.created_at);
    return `${number} | ${name} | ${nik} | ${room} | ${origin} | ${date}`;
  });

  return `${line}
LAPORAN WARGA BARU KOS
${line}
Nama Kos       : ${data.profile.name || '-'}
Alamat         : ${data.profile.address || '-'}
Pengelola      : ${data.profile.manager || '-'}
Telepon        : ${data.profile.phone || '-'}
Periode Laporan: ${data.month_label}
Jumlah Warga   : ${data.total} orang
Dibuat Pada    : ${data.generated_at.toLocaleString('id-ID')}
${thin}
No | Nama                   | NIK                | Kamar  | Asal             | Tanggal Masuk
${thin}
${rows.length ? rows.join('\n') : 'Belum ada penghuni baru pada periode ini.'}
${line}
Laporan ini dihasilkan otomatis oleh Sistem Kos Digital.
Data dilaporkan kepada pihak RT setempat sebagai pemenuhan administrasi kependudukan.
${line}
`;
}

function buildRtPayload(data) {
  return {
    source: 'KOS_DIGITAL',
    report_type: 'NEW_RESIDENTS',
    reference: `RT-${data.month.replace('-', '')}-${Date.now().toString(36).toUpperCase()}`,
    period: data.month,
    kos: {
      name: data.profile.name,
      address: data.profile.address,
      manager: data.profile.manager,
      phone: data.profile.phone,
    },
    total: data.total,
    residents: data.residents.map((resident) => ({
      name: resident.name,
      nik: resident.nik,
      room_number: resident.room_number,
      origin: resident.origin,
      phone: resident.phone,
      check_in: resident.created_at,
    })),
    sent_at: new Date().toISOString(),
  };
}

async function buildPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const emerald = '#059669';
    const dark = '#0f172a';
    const slate = '#475569';
    const light = '#ecfdf5';
    const pageWidth = doc.page.width;
    const left = 46;
    const right = pageWidth - 46;
    const contentWidth = right - left;

    doc.rect(0, 0, pageWidth, 112).fill(emerald);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('KOS DIGITAL', left, 34);
    doc.font('Helvetica').fontSize(10).text('Sistem Pengelolaan Kos Terpadu', left, 60);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('LAPORAN WARGA BARU', left, 80, { width: contentWidth, align: 'right' });

    doc.fillColor(dark).font('Helvetica-Bold').fontSize(14).text(data.profile.name || 'Kos', left, 134);
    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(9)
      .text(data.profile.address || '-', left, 153, { width: contentWidth });
    doc
      .fontSize(9)
      .text(
        `Pengelola: ${data.profile.manager || '-'}  |  Telepon: ${data.profile.phone || '-'}`,
        left,
        169
      );

    doc.moveTo(left, 188).lineTo(right, 188).strokeColor('#cbd5e1').lineWidth(1).stroke();

    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('Periode Laporan', left, 202);
    doc.fillColor(emerald).font('Helvetica-Bold').fontSize(11).text(data.month_label, left + 100, 201);
    doc.fillColor(dark).font('Helvetica-Bold').fontSize(10).text('Jumlah Warga', left, 219);
    doc.fillColor(emerald).font('Helvetica-Bold').fontSize(11).text(`${data.total} orang`, left + 100, 218);
    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(8)
      .text(`Dibuat: ${data.generated_at.toLocaleString('id-ID')}`, left, 237);

    const columns = [
      { key: 'no', label: 'No', width: 26 },
      { key: 'name', label: 'Nama Lengkap', width: 128 },
      { key: 'nik', label: 'NIK', width: 92 },
      { key: 'room', label: 'Kamar', width: 46 },
      { key: 'origin', label: 'Asal', width: 88 },
      { key: 'date', label: 'Tgl Masuk', width: contentWidth - 380 },
    ];

    let y = 260;

    function drawTableHeader() {
      doc.rect(left, y, contentWidth, 22).fill(emerald);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      let x = left;
      for (const column of columns) {
        doc.text(column.label, x + 5, y + 7, { width: column.width - 8, align: 'left' });
        x += column.width;
      }
      y += 22;
    }

    drawTableHeader();

    if (data.residents.length === 0) {
      doc.fillColor(slate).font('Helvetica').fontSize(9).text('Belum ada penghuni baru pada periode ini.', left + 6, y + 10);
      y += 30;
    }

    data.residents.forEach((resident, index) => {
      if (y > 730) {
        doc.addPage();
        y = 60;
        drawTableHeader();
      }
      const values = [
        String(index + 1).padStart(2, '0'),
        resident.name || '-',
        resident.nik || '-',
        resident.room_number || '-',
        resident.origin || '-',
        formatDate(resident.created_at),
      ];
      const rowHeight = 24;
      if (index % 2 === 1) {
        doc.rect(left, y, contentWidth, rowHeight).fill('#f8fafc');
      }
      doc.fillColor(dark).font('Helvetica').fontSize(8);
      let x = left;
      values.forEach((value, columnIndex) => {
        const column = columns[columnIndex];
        doc.text(String(value), x + 5, y + 8, {
          width: column.width - 8,
          align: 'left',
          ellipsis: true,
        });
        x += column.width;
      });
      doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      y += rowHeight;
    });

    y += 24;
    if (y > 690) {
      doc.addPage();
      y = 60;
    }

    doc
      .fillColor(slate)
      .font('Helvetica')
      .fontSize(8)
      .text(
        'Laporan ini dihasilkan otomatis oleh Sistem Kos Digital dan disiapkan untuk diserahkan kepada pihak RT setempat.',
        left,
        y,
        { width: contentWidth }
      );

    y += 46;
    doc.fillColor(dark).font('Helvetica').fontSize(9).text('Pengelola Kos', left, y);
    doc.text('Petugas RT', right - 150, y, { width: 150, align: 'center' });
    y += 16;
    doc.moveTo(left, y).lineTo(left + 130, y).strokeColor('#94a3b8').lineWidth(0.6).stroke();
    doc.moveTo(right - 150, y).lineTo(right, y).strokeColor('#94a3b8').lineWidth(0.6).stroke();
    y += 6;
    doc
      .fontSize(8)
      .text(data.profile.manager || 'Pengelola', left, y, { width: 130, align: 'center' });
    doc.text('( ........................ )', right - 150, y, { width: 150, align: 'center' });

    doc
      .fillColor('#94a3b8')
      .fontSize(7)
      .text(`Kos Digital - Dokumen ${data.month_label}`, left, 790, {
        width: contentWidth,
        align: 'center',
      });

    doc.end();
  });
}

module.exports = {
  buildReportData,
  buildReportText,
  buildRtPayload,
  buildPdfBuffer,
  getResidentYearOptions,
  normalizeMonth,
};
