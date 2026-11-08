(function () {
  'use strict';

  function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }
    return container;
  }

  function toast(message, type) {
    if (!message) return;
    const container = getToastContainer();
    const item = document.createElement('div');
    item.className = 'kos-toast';
    item.dataset.type = type || 'success';
    item.setAttribute('role', 'status');
    item.textContent = message;
    container.appendChild(item);
    setTimeout(function () {
      item.style.transition = 'opacity .3s ease, transform .3s ease';
      item.style.opacity = '0';
      item.style.transform = 'translateY(8px)';
      setTimeout(function () {
        item.remove();
      }, 320);
    }, 4200);
  }

  window.KosUI = window.KosUI || {};
  window.KosUI.toast = toast;

  document.addEventListener('DOMContentLoaded', function () {
    var menuToggle = document.getElementById('menuToggle');
    var mobileMenu = document.getElementById('mobileMenu');
    if (menuToggle && mobileMenu) {
      menuToggle.addEventListener('click', function () {
        var isOpen = !mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden', isOpen);
        menuToggle.setAttribute('aria-expanded', String(!isOpen));
      });
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobileMenu.classList.add('hidden');
          menuToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var sidebar = document.getElementById('sidebar');
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var sidebarClose = document.querySelector('[data-sidebar-close]');

    function openSidebar() {
      if (!sidebar) return;
      sidebar.classList.remove('-translate-x-full');
      if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    function closeSidebar() {
      if (!sidebar) return;
      sidebar.classList.add('-translate-x-full');
      if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeSidebar();
    });

    document.querySelectorAll('[data-dismiss-flash]').forEach(function (button) {
      button.addEventListener('click', function () {
        var flash = button.closest('[data-flash]');
        if (!flash) return;
        flash.style.transition = 'opacity .2s ease';
        flash.style.opacity = '0';
        setTimeout(function () {
          flash.remove();
        }, 220);
      });
    });

    document.querySelectorAll('[data-flash]').forEach(function (flash) {
      setTimeout(function () {
        if (!document.body.contains(flash)) return;
        flash.style.transition = 'opacity .3s ease, transform .3s ease';
        flash.style.opacity = '0';
        flash.style.transform = 'translateY(-6px)';
        setTimeout(function () {
          flash.remove();
        }, 320);
      }, 7000);
    });

    document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
      button.addEventListener('click', function () {
        var target = document.getElementById(button.getAttribute('data-toggle-password'));
        if (!target) return;
        var show = target.type === 'password';
        target.type = show ? 'text' : 'password';
        button.classList.toggle('is-visible', show);
        button.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      });
    });

    document.querySelectorAll('[data-demo-user]').forEach(function (button) {
      button.addEventListener('click', function () {
        var username = document.getElementById('username');
        var password = document.getElementById('password');
        if (username) username.value = button.getAttribute('data-demo-user') || '';
        if (password) password.value = button.getAttribute('data-demo-password') || '';
        if (password) password.focus();
      });
    });

    document.querySelectorAll('form[data-confirm]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        var message = form.getAttribute('data-confirm');
        if (message && !window.confirm(message)) {
          event.preventDefault();
        }
      });
    });

    var deferredPrompt = null;
    var installButtons = document.querySelectorAll('#installApp, [data-install-app]');

    function updateInstallButtons(visible) {
      installButtons.forEach(function (button) {
        button.classList.toggle('hidden', !visible);
        if (visible) button.classList.add('inline-flex');
      });
    }

    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallButtons(true);
    });

    installButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (!deferredPrompt) {
          toast('Gunakan menu browser "Tambahkan ke layar utama" untuk memasang aplikasi.', 'success');
          return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          if (choice.outcome === 'accepted') {
            toast('Aplikasi berhasil dipasang.', 'success');
            updateInstallButtons(false);
          }
          deferredPrompt = null;
        });
      });
    });

    window.addEventListener('appinstalled', function () {
      updateInstallButtons(false);
      toast('Kos Digital terpasang di perangkat Anda.', 'success');
    });

    function showOfflineBanner() {
      if (document.querySelector('.offline-banner')) return;
      var banner = document.createElement('div');
      banner.className = 'offline-banner';
      banner.innerHTML = '<span style="width:7px;height:7px;border-radius:9999px;background:#fbbf24;display:inline-block"></span> Anda sedang offline';
      document.body.appendChild(banner);
    }

    function removeOfflineBanner() {
      var banner = document.querySelector('.offline-banner');
      if (banner) banner.remove();
    }

    window.addEventListener('offline', showOfflineBanner);
    window.addEventListener('online', function () {
      removeOfflineBanner();
      toast('Koneksi kembali online.', 'success');
    });
    if (!navigator.onLine) showOfflineBanner();

    if ('serviceWorker' in navigator) {
      var isSecure =
        location.protocol === 'https:' ||
        ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
      if (isSecure) {
        window.addEventListener('load', function () {
          navigator.serviceWorker
            .register('/service-worker.js', { scope: '/' })
            .catch(function (error) {
              console.warn('Registrasi service worker gagal:', error);
            });
        });
      }
    }
  });
})();
