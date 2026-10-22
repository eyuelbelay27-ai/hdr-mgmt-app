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
