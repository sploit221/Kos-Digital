(function () {
  'use strict';

  var refreshTimer = null;
  var lastUpdated = document.getElementById('lastUpdated');

  function setStat(name, value) {
    document.querySelectorAll('[data-stat="' + name + '"]').forEach(function (element) {
      if (element.textContent !== String(value)) {
        element.textContent = value;
        element.classList.add('text-emerald-600');
        setTimeout(function () {
          element.classList.remove('text-emerald-600');
        }, 900);
      }
    });
  }

  function updateTypeCard(card, type) {
    var available = card.querySelector('.js-type-available');
    var total = card.querySelector('.js-type-total');
    if (available) available.textContent = type.available;
    if (total) total.textContent = type.total;

    var status = card.querySelector('[data-type-status]');
    if (!status) return;
    var hasRoom = Number(type.available) > 0;
    status.className =
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ' +
      (hasRoom
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
        : 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20');
    status.innerHTML =
      '<span class="h-1.5 w-1.5 rounded-full ' +
      (hasRoom ? 'bg-emerald-500' : 'bg-rose-500') +
      '"></span>' +
      (hasRoom ? 'Tersedia' : 'Penuh');
  }

  function toggleEmptyState(selector, show) {
    var element = document.querySelector(selector);
    if (element) element.classList.toggle('hidden', !show);
  }

  function typeSignature(types) {
    return types
      .map(function (type) { return type.room_type; })
      .sort()
      .join('|');
  }

  function renderedTypeSignature() {
    return Array.prototype.map
      .call(document.querySelectorAll('[data-type-card]'), function (card) {
        return card.getAttribute('data-room-type');
      })
      .sort()
      .join('|');
  }

  function applySummary(data) {
    if (!data || !data.rooms) return;
    var rooms = data.rooms;
    var types = data.types || [];
    var hasRoomData = Number(rooms.total) > 0;

    if (typeSignature(types) !== renderedTypeSignature()) {
      window.location.reload();
      return;
    }

    setStat('total', rooms.total);
    setStat('kosong', rooms.kosong);
    setStat('terisi', rooms.terisi);
    setStat('maintenance', rooms.maintenance);

    toggleEmptyState('[data-availability-empty]', !hasRoomData);
    toggleEmptyState('[data-availability-content]', hasRoomData);
    toggleEmptyState('[data-type-empty]', types.length === 0);
    toggleEmptyState('[data-type-grid]', types.length > 0);

    var occupancy = rooms.total ? Math.round((rooms.terisi / rooms.total) * 100) : 0;
    var bar = document.getElementById('occupancyBar');
    var percent = document.getElementById('occupancyPercent');
    if (bar) bar.style.width = occupancy + '%';
    if (percent) percent.textContent = occupancy;

    var typeLive = document.getElementById('typeLiveText');
    if (typeLive) {
      typeLive.textContent = hasRoomData
        ? rooms.kosong + ' kamar kosong'
        : 'Belum ada data ketersediaan';
    }

    var cards = document.querySelectorAll('[data-type-card]');
    types.forEach(function (type) {
      cards.forEach(function (card) {
        if (card.getAttribute('data-room-type') === type.room_type) {
          updateTypeCard(card, type);
        }
      });
    });

    if (lastUpdated) {
      var time = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date());
      lastUpdated.textContent = time;
    }
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      var response = await fetch('/api/public/summary', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var json = await response.json();
      if (json && json.ok) applySummary(json.data);
    } catch (error) {
      if (lastUpdated) lastUpdated.textContent = 'gagal memperbarui';
    }
  }

  function start() {
    refresh();
    refreshTimer = window.setInterval(refresh, 10000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();
    });
    window.addEventListener('online', refresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.addEventListener('pagehide', function () {
    if (refreshTimer) window.clearInterval(refreshTimer);
  });
})();
