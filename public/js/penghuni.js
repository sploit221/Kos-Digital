(function () {
  'use strict';

  function initCharCounters() {
    document.querySelectorAll('[data-char-input]').forEach(function (input) {
      var counter = document.querySelector('[data-char-count]');
      if (!counter) return;
      var max = input.getAttribute('maxlength') || 2000;
      function update() {
        counter.textContent = input.value.length + '/' + max;
      }
      input.addEventListener('input', update);
      update();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCharCounters);
  } else {
    initCharCounters();
  }
})();
