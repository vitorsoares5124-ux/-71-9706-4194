/* carousel-fallback.js
 * Fallback em JS puro para os carrosseis Elementor/Swiper da pagina.
 * So e ativado se o Swiper oficial NAO tiver inicializado o container
 * (classe .swiper-initialized ausente). Se o Swiper inicializar depois,
 * o fallback se desmonta sozinho via MutationObserver.
 */
(function () {
  'use strict';

  var DESKTOP_MIN = 1025;
  var TABLET_MIN = 768;

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function perViewFor(cfg, w) {
    if (w >= DESKTOP_MIN) return cfg.perView.desktop;
    if (w >= TABLET_MIN) return cfg.perView.tablet;
    return cfg.perView.mobile;
  }

  function cfgFor(widget) {
    if (widget.classList.contains('elementor-widget-image-carousel')) {
      return {
        gap: 20,
        perView: { desktop: 3, tablet: 2, mobile: 1 },
        autoplay: 1800,
        loop: true,
        pagination: false
      };
    }
    if (widget.classList.contains('elementor-widget-testimonial-carousel')) {
      return {
        gap: 10,
        perView: { desktop: 3, tablet: 2, mobile: 1 },
        autoplay: 5000,
        loop: true,
        pagination: true
      };
    }
    return null;
  }

  function initOne(container) {
    var widget = container.closest('.elementor-widget');
    if (!widget) return null;
    var cfg = cfgFor(widget);
    if (!cfg) return null;
    var wrapper = container.querySelector('.swiper-wrapper');
    if (!wrapper) return null;
    var slides = Array.prototype.filter.call(wrapper.children, function (el) {
      return el.classList && el.classList.contains('swiper-slide');
    });
    if (slides.length < 2) return null;

    var prev = widget.querySelector('.elementor-swiper-button-prev');
    var next = widget.querySelector('.elementor-swiper-button-next');
    var state = { i: 0, timer: null, resumeT: null };

    container.classList.add('rv-fallback');
    if (prev) prev.classList.add('rv-fallback-nav');
    if (next) next.classList.add('rv-fallback-nav');

    var dotsWrap = null;
    var dots = [];
    var pagHost = widget.querySelector('.swiper-pagination');
    if (cfg.pagination && pagHost) {
      dotsWrap = document.createElement('div');
      dotsWrap.className = 'rv-fallback-dots';
      dotsWrap.setAttribute('role', 'tablist');
      pagHost.parentNode.insertBefore(dotsWrap, pagHost.nextSibling);
    }

    function metrics() {
      var w = container.clientWidth || window.innerWidth;
      var pv = Math.min(perViewFor(cfg, w), slides.length);
      var slideW = (w - cfg.gap * (pv - 1)) / pv;
      return { pv: pv, slideW: slideW, max: slides.length - pv };
    }

    function paintDots(max) {
      if (!dotsWrap) return;
      if (dots.length !== max + 1) {
        dotsWrap.innerHTML = '';
        dots = [];
        for (var d = 0; d <= max; d++) {
          (function (idx) {
            var b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('aria-label', 'Ir para o slide ' + (idx + 1));
            b.addEventListener('click', function () {
              go(idx, true);
            });
            dotsWrap.appendChild(b);
            dots.push(b);
          })(d);
        }
      }
      dots.forEach(function (b, k) {
        if (k === state.i) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    function render(animate) {
      var m = metrics();
      if (state.i > m.max) state.i = m.max;
      if (!animate) wrapper.style.transition = 'none';
      else wrapper.style.transition = '';
      slides.forEach(function (s, k) {
        s.style.flex = '0 0 ' + m.slideW + 'px';
        s.style.maxWidth = m.slideW + 'px';
        s.style.marginRight = k === slides.length - 1 ? '0px' : cfg.gap + 'px';
      });
      wrapper.style.transform =
        'translate3d(' + -state.i * (m.slideW + cfg.gap) + 'px,0,0)';
      if (!animate) {
        void wrapper.offsetWidth;
        wrapper.style.transition = '';
      }
      paintDots(m.max);
    }

    function stopAuto() {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (!cfg.autoplay || reduceMotion) return;
      if (slides.length <= metrics().pv) return;
      state.timer = setInterval(function () {
        go(state.i + 1, false);
      }, cfg.autoplay);
    }

    function userPause() {
      stopAuto();
      if (state.resumeT) clearTimeout(state.resumeT);
      state.resumeT = setTimeout(startAuto, 8000);
    }

    function go(n, manual) {
      var m = metrics();
      if (n > m.max) n = cfg.loop ? 0 : m.max;
      if (n < 0) n = cfg.loop ? m.max : 0;
      state.i = n;
      render(true);
      if (manual) userPause();
    }

    function onPrev(e) {
      if (e) e.preventDefault();
      go(state.i - 1, true);
    }
    function onNext(e) {
      if (e) e.preventDefault();
      go(state.i + 1, true);
    }
    function onKey(fn) {
      return function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fn(e);
        }
      };
    }

    if (prev) {
      prev.addEventListener('click', onPrev);
      prev.addEventListener('keydown', onKey(onPrev));
    }
    if (next) {
      next.addEventListener('click', onNext);
      next.addEventListener('keydown', onKey(onNext));
    }

    var touchX = null;
    container.addEventListener(
      'touchstart',
      function (e) {
        touchX = e.touches[0].clientX;
      },
      { passive: true }
    );
    container.addEventListener(
      'touchend',
      function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 40) go(state.i + (dx < 0 ? 1 : -1), true);
      },
      { passive: true }
    );

    if (cfg.autoplay && !reduceMotion) {
      widget.addEventListener('mouseenter', stopAuto);
      widget.addEventListener('mouseleave', startAuto);
    }
    window.addEventListener('resize', function () {
      render(false);
    });

    render(false);
    startAuto();

    return {
      el: container,
      destroy: function () {
        stopAuto();
        if (state.resumeT) clearTimeout(state.resumeT);
        container.classList.remove('rv-fallback');
        wrapper.style.transform = '';
        wrapper.style.transition = '';
        slides.forEach(function (s) {
          s.style.flex = '';
          s.style.maxWidth = '';
          s.style.marginRight = '';
        });
        if (dotsWrap && dotsWrap.parentNode) dotsWrap.parentNode.removeChild(dotsWrap);
        [prev, next].forEach(function (b) {
          if (b && b.parentNode) b.parentNode.replaceChild(b.cloneNode(true), b);
        });
      }
    };
  }

  var live = [];

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('.elementor .swiper'), function (c) {
      if (c.classList.contains('swiper-initialized')) return;
      if (c.classList.contains('rv-fallback')) return;
      var widget = c.closest('.elementor-widget');
      if (!widget || !cfgFor(widget)) return;
      var inst = initOne(c);
      if (inst) live.push(inst);
    });
    if (live.length && 'MutationObserver' in window) {
      var obs = new MutationObserver(function () {
        live = live.filter(function (inst) {
          if (inst.el.classList.contains('swiper-initialized')) {
            inst.destroy();
            return false;
          }
          return true;
        });
        if (!live.length) obs.disconnect();
      });
      live.forEach(function (inst) {
        obs.observe(inst.el, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  function ready() {
    // Espera o Elementor/Swiper oficial tentar inicializar primeiro.
    setTimeout(boot, 1500);
  }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
})();
