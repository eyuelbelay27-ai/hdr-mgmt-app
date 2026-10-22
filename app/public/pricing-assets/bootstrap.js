/*
 * Pricing tool bridge — loaded first by every pricing tool page inside the
 * app. The tools were built to save in one browser; this swaps that for the
 * app's shared database:
 *   - settings/catalog keys (window.__PRICING__.sharedKeys) come from the
 *     server and are saved back to it, only while Settings is unlocked
 *     with the Pricing PIN;
 *   - the quote being worked on stays in this browser only;
 *   - invoice numbers come from one shared server counter.
 * Settings lock again whenever the page loads or another tab is opened.
 */
(function () {
  var cfg = window.__PRICING__ || {};
  var TOOL = cfg.tool;
  var SHARED = cfg.shared || {};
  var KEYS = cfg.sharedKeys || [];
  var LP = 'pricing:' + TOOL + ':';
  var unlocked = false;

  function isShared(k) { return KEYS.indexOf(k) >= 0; }

  // ---- icons (Lucide-style line icons, shared by the tools and ui.js) ----
  var ICONS = {
    quote: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    width: '<path d="m18 8 4 4-4 4"/><path d="m6 8-4 4 4 4"/><path d="M2 12h20"/>',
    height: '<path d="M12 2v20"/><path d="m8 18 4 4 4-4"/><path d="m8 6 4-4 4 4"/>',
    percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    list: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    footing: '<path d="M3 21h18"/><path d="M6 21v-4h12v4"/><path d="M9 17v-5h6v5"/><path d="M12 12V3"/>',
    scaffold: '<path d="M5 3v18"/><path d="M19 3v18"/><path d="M5 8h14"/><path d="M5 14h14"/><path d="M5 20h14"/><path d="m5 8 14 6"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><path d="M16 14v4"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'
  };
  window.ptIcon = function (name) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };
  window.ptFillIcons = function () {
    document.querySelectorAll('[data-ic]').forEach(function (el) {
      if (!el.firstElementChild) el.innerHTML = window.ptIcon(el.getAttribute('data-ic'));
    });
  };
  document.addEventListener('DOMContentLoaded', window.ptFillIcons);

  var ls = {
    get: function (k) { try { return window.localStorage.getItem(LP + k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(LP + k, v); } catch (e) {} },
    remove: function (k) { try { window.localStorage.removeItem(LP + k); } catch (e) {} }
  };

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (r.status === 204) return { ok: true };
      return r.json().catch(function () { return { ok: false, error: 'Server error (' + r.status + ').' }; });
    });
  }
  var offline = function () { return { ok: false, error: 'Could not reach the server. Check the connection.' }; };

  // ---- small message bar ----
  var toastTimer;
  function notify(msg) {
    var t = document.getElementById('pricingToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pricingToast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = 'none'; }, 5000);
  }

  // ---- shared saving (debounced per key) ----
  var timers = {}, waiters = {}, values = {};
  function send(key) {
    var list = waiters[key] || [];
    waiters[key] = [];
    timers[key] = null;
    return post('/api/pricing/store', { tool: TOOL, key: key, value: values[key] }).catch(offline).then(function (r) {
      if (!r.ok) notify(r.error || 'Settings could not be saved.');
      list.forEach(function (w) { r.ok ? w.resolve(true) : w.reject(new Error(r.error || 'save failed')); });
      return r.ok;
    });
  }
  function pushShared(key, value) {
    SHARED[key] = value;
    if (!unlocked) return Promise.resolve(false);
    values[key] = value;
    clearTimeout(timers[key]);
    return new Promise(function (resolve, reject) {
      (waiters[key] = waiters[key] || []).push({ resolve: resolve, reject: reject });
      timers[key] = setTimeout(function () { send(key); }, 500);
    });
  }
  function flush() {
    return Promise.all(Object.keys(timers).filter(function (k) { return timers[k]; }).map(function (k) {
      clearTimeout(timers[k]);
      return send(k);
    }));
  }

  // ---- PIN ----
  post('/api/pricing/lock'); // a freshly opened tool always starts locked
  window.hadarUnlock = function (pin) {
    return post('/api/pricing/unlock', { pin: pin }).catch(offline).then(function (r) {
      if (r.ok) unlocked = true;
      return r;
    });
  };
  window.hadarLock = function () {
    if (!unlocked) return;
    unlocked = false;
    flush().then(function () { post('/api/pricing/lock'); });
  };
  window.hadarChangePin = function (current, pin, confirm) {
    return post('/api/pricing/pin', { current: current, pin: pin, confirm: confirm }).catch(offline);
  };
  window.hadarNextInvoiceNumber = function () {
    return post('/api/pricing/counter', { tool: TOOL }).then(function (r) {
      if (!r.ok) throw new Error(r.error || 'No invoice number');
      return { year: r.year, next: r.value, label: r.label };
    });
  };
  window.addEventListener('pagehide', function () {
    if (unlocked) { flush(); navigator.sendBeacon('/api/pricing/lock'); }
  });

  // ---- Lightbox: synchronous localStorage-style store ----
  var ITEMS = 'hadar_items_v1';
  var JOB_FIELDS = ['qty', 'm2', 'excludedFromJob'];
  window.hadarStore = {
    getItem: function (k) {
      if (!isShared(k)) return ls.get(k);
      var v = SHARED[k];
      if (v == null) return null;
      if (k !== ITEMS) return v;
      // Catalog from the server + this browser's quantities for the current job.
      try {
        var list = JSON.parse(v);
        var overlay = JSON.parse(ls.get('job_overlay') || '{}');
        list.forEach(function (it) {
          var o = overlay[it.id];
          if (o) JOB_FIELDS.forEach(function (f) { if (o[f] !== undefined) it[f] = o[f]; });
          // Not in this browser's quote yet: start from the item's default tick.
          else it.excludedFromJob = it.includeByDefault === false;
        });
        return JSON.stringify(list);
      } catch (e) { return v; }
    },
    setItem: function (k, v) {
      v = String(v);
      if (!isShared(k)) return ls.set(k, v);
      if (k === ITEMS) {
        try {
          var overlay = {};
          var catalog = JSON.parse(v).map(function (it) {
            var c = {}, o = {};
            Object.keys(it).forEach(function (f) { c[f] = it[f]; });
            JOB_FIELDS.forEach(function (f) { o[f] = it[f]; });
            overlay[it.id] = o;
            c.qty = null; c.m2 = null; c.excludedFromJob = false;
            return c;
          });
          ls.set('job_overlay', JSON.stringify(overlay));
          v = JSON.stringify(catalog);
        } catch (e) {}
      }
      if (v === SHARED[k]) return;
      pushShared(k, v);
    },
    removeItem: function (k) { if (!isShared(k)) ls.remove(k); }
  };

  // ---- Neon / Tapela / Hanger: async window.storage ----
  window.storage = {
    get: function (k) {
      var v = isShared(k) ? SHARED[k] : ls.get(k);
      return Promise.resolve(v != null ? { key: k, value: v, shared: isShared(k) } : null);
    },
    set: function (k, v) {
      v = String(v);
      if (!isShared(k)) { ls.set(k, v); return Promise.resolve({ key: k, value: v }); }
      return pushShared(k, v).then(function (saved) {
        if (!saved) throw new Error('Settings are locked');
        return { key: k, value: v, shared: true };
      });
    },
    delete: function (k) { if (!isShared(k)) ls.remove(k); return Promise.resolve({ key: k, deleted: true }); },
    list: function () { return Promise.resolve({ keys: KEYS.slice(), shared: true }); }
  };

  // ---- PIN prompt for tools without their own (Neon / Tapela / Hanger) ----
  function pinPrompt(onOk) {
    var scrim = document.createElement('div');
    scrim.className = 'pricing-pin-scrim';
    scrim.innerHTML =
      '<form class="pricing-pin-box" autocomplete="off">' +
      '<h3>🔒 Settings Locked</h3>' +
      '<p>Enter the Pricing PIN to continue.</p>' +
      '<input type="password" inputmode="numeric" placeholder="PIN" aria-label="Pricing PIN">' +
      '<div class="pricing-pin-err"></div>' +
      '<div class="pricing-pin-row"><button type="submit" class="pricing-pin-ok">Unlock</button>' +
      '<button type="button" class="pricing-pin-cancel">Cancel</button></div></form>';
    document.body.appendChild(scrim);
    var form = scrim.querySelector('form'), input = scrim.querySelector('input'), err = scrim.querySelector('.pricing-pin-err');
    setTimeout(function () { input.focus(); }, 30);
    scrim.querySelector('.pricing-pin-cancel').addEventListener('click', function () { scrim.remove(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      window.hadarUnlock(input.value).then(function (r) {
        if (r.ok) { scrim.remove(); onOk(); }
        else { err.textContent = r.error || 'Incorrect PIN.'; input.value = ''; input.focus(); }
      });
    });
  }

  document.addEventListener('click', function (e) {
    var tab = e.target && e.target.closest ? e.target.closest('.tab[data-tab], .tab-btn[data-tab]') : null;
    if (!tab) return;
    if (tab.dataset.tab !== 'settings') {
      // Leaving Settings locks it again — next time asks for the PIN.
      if (unlocked) {
        window.hadarLock();
        try { if (TOOL === 'lightbox') settingsUnlockedThisSession = false; } catch (err) {}
      }
      return;
    }
    if (TOOL === 'lightbox' || unlocked) return; // Lightbox has its own PIN modal
    e.preventDefault();
    e.stopImmediatePropagation();
    pinPrompt(function () { tab.click(); });
  }, true);
})();
