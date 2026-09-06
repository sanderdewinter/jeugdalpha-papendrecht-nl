/* Jeugdalpha Papendrecht — one small script, no dependencies.
 *
 * Everything that changes per season lives in /data/*.json.
 * This file only reads that data and renders it.
 */
(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Absolute paths so the same script works from every subdirectory. */
  var DATA = {
    events: '/data/events.json',
    albums: '/data/albums.json',
    site: '/data/site.json'
  };

  var cache = {};
  function load(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
        return r.json();
      });
    }
    return cache[url];
  }

  function fail(node, what) {
    return function (err) {
      console.error('[jeugdalpha]', what, err);
      if (node) {
        node.innerHTML = '<div class="events-empty"><p>Deze informatie kon even niet geladen worden. ' +
          'Mail ons op <a href="mailto:jeugdalphapapendrecht@hotmail.com">jeugdalphapapendrecht@hotmail.com</a> ' +
          'en we vertellen je precies wanneer we beginnen.</p></div>';
      }
    };
  }

  /* ---------------------------------------------------------------- dates */
  var MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MONTH_LONG  = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus',
                     'september', 'oktober', 'november', 'december'];

  /* Parse "2026-09-19" as a *local* date — never let a timezone shift the day. */
  function parseDate(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function today() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function longDate(d) {
    return d.getDate() + ' ' + MONTH_LONG[d.getMonth()] + ' ' + d.getFullYear();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Merge an event with the season defaults. `null` in the event wins, so the
     Alphaweekend can explicitly have no time and no location. */
  function resolve(ev, defaults) {
    var d = defaults || {};
    return {
      date: parseDate(ev.date),
      endDate: ev.endDate ? parseDate(ev.endDate) : null,
      title: ev.title,
      description: ev.description || '',
      highlight: !!ev.highlight,
      badge: ev.badge || '',
      start: 'start' in ev ? ev.start : d.start,
      end: 'end' in ev ? ev.end : d.end,
      location: 'location' in ev ? ev.location : d.location
    };
  }

  /* --------------------------------------------------------------- events */
  function eventMarkup(ev) {
    var multi = ev.endDate && ev.endDate.getTime() !== ev.date.getTime();
    var facts = [];
    if (ev.start && ev.end) facts.push('<span>🕖 ' + esc(ev.start) + '–' + esc(ev.end) + '</span>');
    if (multi) facts.push('<span>📅 t/m ' + esc(longDate(ev.endDate)) + '</span>');
    if (ev.location) {
      facts.push('<span>📍 ' + esc(ev.location.name) +
        (ev.location.address ? ', ' + esc(ev.location.address) : '') + '</span>');
    } else {
      facts.push('<span>📍 Locatie volgt</span>');
    }

    return '<article class="event' + (ev.highlight ? ' event--highlight' : '') + '">' +
      '<div class="event__date">' +
        '<span class="event__day">' + ev.date.getDate() + '</span>' +
        '<span class="event__month">' + MONTH_SHORT[ev.date.getMonth()] + '</span>' +
        (multi ? '<span class="event__range">t/m ' + ev.endDate.getDate() + ' ' +
                 MONTH_SHORT[ev.endDate.getMonth()] + '</span>' : '') +
      '</div>' +
      '<div class="event__body">' +
        (ev.badge ? '<span class="event__badge">' + esc(ev.badge) + '</span>' : '') +
        '<h3 class="event__title">' + esc(ev.title) + '</h3>' +
        '<div class="event__facts">' + facts.join('') + '</div>' +
        (ev.description ? '<p class="event__desc">' + esc(ev.description) + '</p>' : '') +
      '</div>' +
    '</article>';
  }

  function renderEvents() {
    var nodes = $$('[data-events]');
    if (!nodes.length) return;

    load(DATA.events).then(function (data) {
      var all = data.events.map(function (e) { return resolve(e, data.defaults); });

      nodes.forEach(function (node) {
        var mode = node.getAttribute('data-events');            /* "upcoming" | "all" */
        var limit = parseInt(node.getAttribute('data-limit'), 10);
        var grouped = node.hasAttribute('data-grouped');
        var t = today();

        var list = all;
        if (mode === 'upcoming') {
          list = all.filter(function (e) { return (e.endDate || e.date) >= t; });
        }
        if (limit > 0) list = list.slice(0, limit);

        if (!list.length) {
          node.innerHTML = '<div class="events-empty"><p><strong>Het seizoen is afgelopen.</strong> ' +
            'De data voor het volgende seizoen komen hier zodra ze bekend zijn — ' +
            'of mail ons, dan laten we het je weten.</p></div>';
          return;
        }

        if (!grouped) {
          node.innerHTML = '<div class="events">' + list.map(eventMarkup).join('') + '</div>';
          return;
        }

        var html = '', month = null;
        list.forEach(function (ev) {
          var key = ev.date.getFullYear() + '-' + ev.date.getMonth();
          if (key !== month) {
            if (month !== null) html += '</div>';
            html += '<h2 class="month-label">' + MONTH_LONG[ev.date.getMonth()] +
                    ' ' + ev.date.getFullYear() + '</h2><div class="events">';
            month = key;
          }
          html += eventMarkup(ev);
        });
        node.innerHTML = html + '</div>';
      });
    }).catch(fail(nodes[0], 'events'));
  }

  /* Season sentences: <span data-season="start"> etc. */
  function renderSeason() {
    var nodes = $$('[data-season]');
    if (!nodes.length) return;

    load(DATA.events).then(function (data) {
      var s = data.season || {};
      var start = s.startDate ? parseDate(s.startDate) : null;
      var end = s.endDate ? parseDate(s.endDate) : null;
      var t = today();
      var upcoming = data.events
        .map(function (e) { return resolve(e, data.defaults); })
        .filter(function (e) { return (e.endDate || e.date) >= t; })[0];

      var values = {
        label: s.label || '',
        start: start ? longDate(start) : '',
        'start-short': start ? start.getDate() + ' ' + MONTH_LONG[start.getMonth()] : '',
        'start-weekday': start ? ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag',
                                  'vrijdag', 'zaterdag'][start.getDay()] : '',
        end: end ? longDate(end) : '',
        evenings: s.eveningCount || '',
        note: s.note || '',
        'next-title': upcoming ? upcoming.title : '',
        'next-date': upcoming ? longDate(upcoming.date) : ''
      };

      nodes.forEach(function (node) {
        var key = node.getAttribute('data-season');
        if (values[key] !== undefined && values[key] !== '') {
          node.textContent = values[key];
        } else if (node.hasAttribute('data-season-fallback')) {
          node.textContent = node.getAttribute('data-season-fallback');
        }
      });

      /* Whole blocks that only make sense while a season is running. */
      $$('[data-season-if="upcoming"]').forEach(function (n) { n.hidden = !upcoming; });
      $$('[data-season-if="ended"]').forEach(function (n) { n.hidden = !!upcoming; });
    }).catch(function (err) { console.error('[jeugdalpha] season', err); });
  }

  /* -------------------------------------------------------------- socials */
  function renderSocials() {
    var nodes = $$('[data-socials]');
    var mails = $$('[data-site="email"], [data-site="email-href"]');
    if (!nodes.length && !mails.length) return;

    load(DATA.site).then(function (site) {
      mails.forEach(function (n) {
        var how = n.getAttribute('data-site');
        if (how === 'email') n.textContent = site.email;      /* show the address */
        if (n.tagName === 'A') n.setAttribute('href', 'mailto:' + site.email);
      });

      var s = site.socials || {};
      var links = [];
      if (s.instagram) links.push(['Instagram', s.instagram]);
      if (s.facebook) links.push(['Facebook', s.facebook]);
      if (s.whatsapp) links.push(['WhatsApp', 'https://wa.me/' + String(s.whatsapp).replace(/\D/g, '')]);
      if (site.youtube) links.push(['YouTube', site.youtube]);

      nodes.forEach(function (node) {
        if (!links.length) { node.hidden = true; return; }
        node.hidden = false;
        node.innerHTML = links.map(function (l) {
          return '<a href="' + esc(l[1]) + '" rel="noopener">' + esc(l[0]) + '</a>';
        }).join('');
      });
    }).catch(function (err) { console.error('[jeugdalpha] socials', err); });
  }

  /* -------------------------------------------------------------- gallery */
  function renderGallery() {
    var root = $('[data-gallery]');
    if (!root) return;

    load(DATA.albums).then(function (data) {
      var photos = [];
      root.innerHTML = data.albums.map(function (album) {
        var thumbs = album.photos.map(function (p) {
          var i = photos.push(p) - 1;
          return '<button type="button" data-photo="' + i + '" aria-label="Foto ' +
            (i + 1) + ' uit ' + esc(album.title) + ' groter bekijken">' +
            '<img src="/' + esc(p.thumb) + '" alt="" loading="lazy" decoding="async"></button>';
        }).join('');

        return '<section class="stack" id="' + esc(album.slug) + '">' +
          '<h2 class="month-label">' + esc(album.title) + '</h2>' +
          '<p class="muted">' + esc(album.description) + ' · ' + album.photos.length + ' foto\'s</p>' +
          '<div class="gallery">' + thumbs + '</div>' +
        '</section>';
      }).join('');

      initLightbox(root, photos);
    }).catch(fail(root, 'albums'));
  }

  function initLightbox(root, photos) {
    var dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.innerHTML =
      '<figure class="lightbox__figure"><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox__btn lightbox__btn--prev" aria-label="Vorige foto">‹</button>' +
      '<button type="button" class="lightbox__btn lightbox__btn--next" aria-label="Volgende foto">›</button>' +
      '<button type="button" class="lightbox__btn lightbox__close" aria-label="Sluiten">✕</button>';
    document.body.appendChild(dlg);

    var img = $('img', dlg), cap = $('figcaption', dlg), i = 0;

    function show(n) {
      i = (n + photos.length) % photos.length;
      img.src = '/' + photos[i].thumb;          /* instant: already cached */
      var full = new Image();
      full.onload = function () { if (full.src.indexOf(photos[i].full) !== -1) img.src = full.src; };
      full.src = '/' + photos[i].full;
      cap.textContent = 'Foto ' + (i + 1) + ' van ' + photos.length;
    }

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-photo]');
      if (!btn) return;
      show(+btn.getAttribute('data-photo'));
      if (typeof dlg.showModal === 'function') dlg.showModal();
    });

    $('.lightbox__btn--prev', dlg).addEventListener('click', function () { show(i - 1); });
    $('.lightbox__btn--next', dlg).addEventListener('click', function () { show(i + 1); });
    $('.lightbox__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.classList.contains('lightbox__figure')) dlg.close();
    });
  }

  /* --------------------------------------------------------------- videos */
  /* Nothing is embedded until someone clicks: no YouTube/Vimeo/Drive request
     on page load, and pages with 6 episodes stay light. */
  var EMBED = {
    yt: function (id) { return 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&autoplay=1'; },
    vimeo: function (id) { return 'https://player.vimeo.com/video/' + id + '?autoplay=1'; },
    drive: function (id) { return 'https://drive.google.com/file/d/' + id + '/preview'; }
  };

  function initVideos() {
    $$('[data-video-id]').forEach(function (holder) {
      var btn = $('.video__btn', holder);
      if (!btn) return;
      btn.addEventListener('click', function () {
        var kind = holder.getAttribute('data-video-kind') || 'yt';
        var src = (EMBED[kind] || EMBED.yt)(holder.getAttribute('data-video-id'));
        var frame = document.createElement('iframe');
        frame.src = src;
        frame.title = holder.getAttribute('data-video-title') || 'Video';
        frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        frame.allowFullscreen = true;
        frame.loading = 'lazy';
        holder.innerHTML = '';
        holder.appendChild(frame);
      });
    });
  }

  /* ------------------------------------------------------------------ nav */
  function initNav() {
    var toggle = $('.nav-toggle'), nav = $('#site-nav');
    if (!toggle || !nav) return;

    function set(open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
      document.body.setAttribute('data-nav-open', String(open));
    }
    toggle.addEventListener('click', function () {
      set(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') set(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { set(false); toggle.focus(); }
    });
    /* Reset when the layout crosses into desktop. */
    var mq = window.matchMedia('(min-width: 900px)');
    mq.addEventListener('change', function (e) { if (e.matches) set(false); });
  }

  /* --------------------------------------------------------------- reveal */
  function initReveal() {
    var nodes = $$('.reveal');
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* Mark the current page in the nav without hardcoding it per page. */
  function markCurrent() {
    var here = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
    $$('#site-nav a').forEach(function (a) {
      var target = a.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
      if (target === here || (target !== '/' && here.indexOf(target + '/') === 0)) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  function boot() {
    initNav();
    markCurrent();
    initReveal();
    initVideos();
    renderEvents();
    renderSeason();
    renderSocials();
    renderGallery();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
