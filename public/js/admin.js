(function () {
  'use strict';

  function toast(message, type) {
    if (window.KosUI && window.KosUI.toast) window.KosUI.toast(message, type);
  }

  function initRoomSearch() {
    var input = document.querySelector('[data-room-search]');
    if (!input) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-room-card]'));
    var empty = document.querySelector('[data-room-empty]');

    function filter() {
      var query = input.value.trim().toLowerCase();
      var visible = 0;
      cards.forEach(function (card) {
        var match = !query || (card.getAttribute('data-search') || '').includes(query);
        card.classList.toggle('hidden', !match);
        if (match) visible += 1;
      });
      if (empty) empty.classList.toggle('hidden', visible > 0);
    }

    input.addEventListener('input', filter);
  }

  function initReportSender() {
    var button = document.getElementById('sendRtReport');
    if (!button) return;
    var resultBox = document.getElementById('rtResult');
    var label = button.querySelector('[data-send-label]');
    var icon = button.querySelector('[data-send-icon]');
    var sent = false;

    function showResult(type, message) {
      if (!resultBox) return;
      resultBox.classList.remove('hidden');
      resultBox.className =
        'mt-4 rounded-2xl border p-4 text-xs font-medium ' +
        (type === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800');
      resultBox.textContent = message;
    }

    function setLoading(loading) {
      button.disabled = loading || sent;
      if (label) {
        label.textContent = loading
          ? 'Mengirim laporan...'
          : sent
            ? 'Laporan Terkirim'
            : 'Kirim Laporan ke RT';
      }
      if (icon) icon.classList.toggle('animate-pulse', loading && !sent);
    }

    function markAllReported(total) {
      sent = true;
      if (label) label.textContent = 'Laporan Terkirim';
      if (icon) icon.classList.remove('animate-pulse');
      document.querySelectorAll('[data-rt-badge]').forEach(function (badge) {
        badge.textContent = 'Terkirim';
        badge.className =
          'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20';
      });
      var unreported = document.querySelector('[data-unreported]');
      if (unreported) {
        unreported.innerHTML =
          '0<span class="ml-1 text-xs font-semibold text-amber-600">orang</span>';
      }
      var reported = document.querySelector('[data-reported]');
      if (reported) {
        reported.innerHTML =
          String(total) +
          '<span class="ml-1 text-xs font-semibold text-emerald-600">orang</span>';
      }
    }

    button.addEventListener('click', async function () {
      if (button.disabled) return;
      var month = button.getAttribute('data-month');
      var total = Number(button.getAttribute('data-total') || 0);

      if (total === 0) {
        showResult('error', 'Tidak ada penghuni baru pada periode ini untuk dilaporkan.');
        toast('Tidak ada data warga baru pada periode ini.', 'error');
        return;
      }

      var confirmed = window.confirm(
        'Kirim laporan ' + total + ' warga baru periode ini ke pihak RT? Status laporan akan diperbarui.'
      );
      if (!confirmed) return;

      setLoading(true);
      if (resultBox) resultBox.classList.add('hidden');

      try {
        var response = await fetch('/admin/reports/rt/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ month: month })
        });

        var contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          window.location.href = '/login';
          return;
        }

        var data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.message || 'Gagal mengirim laporan.');
        }

        showResult(
          'success',
          data.message +
            ' Referensi: ' +
            data.reference +
            '. Endpoint simulasi: ' +
            data.endpoint +
            '.'
        );
        markAllReported(data.total);
        toast(data.message, 'success');
      } catch (error) {
        showResult('error', error.message || 'Terjadi kesalahan saat mengirim laporan.');
        toast(error.message || 'Gagal mengirim laporan.', 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  function initPrint() {
    var button = document.getElementById('printReport');
    if (button) button.addEventListener('click', function () { window.print(); });
  }

  function setAdminStat(name, value) {
    document.querySelectorAll('[data-admin-stat="' + name + '"]').forEach(function (element) {
      element.textContent = value;
    });
  }

  function initDashboardStats() {
    var root = document.querySelector('[data-admin-dashboard]');
    if (!root) return;

    fetch('/api/admin/dashboard', {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        if (!json || !json.ok || !json.data) return;
        var data = json.data;
        var rooms = data.rooms || {};
        var maintenance = data.maintenance || {};

        setAdminStat('totalRooms', rooms.total || 0);
        setAdminStat('occupancy', data.occupancy || 0);
        setAdminStat('residentCount', data.resident_count || 0);
        setAdminStat(
          'maintenanceActive',
          (maintenance.pending || 0) + (maintenance.diproses || 0)
        );
        setAdminStat(
          'maintenanceDetail',
          (maintenance.pending || 0) + ' pending · ' + (maintenance.diproses || 0) + ' diproses'
        );
        setAdminStat('roomsTerisi', rooms.terisi || 0);
        setAdminStat('roomsKosong', rooms.kosong || 0);
        setAdminStat('roomsMaintenance', rooms.maintenance || 0);
        setAdminStat('rtPending', data.rt_pending || 0);

        var total = Number(rooms.total) || 0;
        document.querySelectorAll('[data-admin-bar]').forEach(function (bar) {
          var key = bar.getAttribute('data-admin-bar');
          var value = Number(rooms[key]) || 0;
          bar.style.width = (total ? (value / total) * 100 : 0) + '%';
        });
      })
      .catch(function () {
        // Server-rendered values remain visible when the refresh fails.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initRoomSearch();
      initReportSender();
      initPrint();
      initDashboardStats();
    });
  } else {
    initRoomSearch();
    initReportSender();
    initPrint();
    initDashboardStats();
  }
})();
