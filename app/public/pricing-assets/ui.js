/*
 * Pricing tools — UI layer (runs after the page is parsed, before the
 * tools' own DOMContentLoaded setup). Purely presentational:
 *   - a sticky bottom bar with the live total and the tool's main action
 *     (it just clicks the tool's own button, so behaviour is unchanged);
 *   - data-label on table cells so tables can be shown as cards on phones;
 *   - the tool's "Saved / Settings loaded" status moved into the tab bar.
 */
(function () {
  var tool = (window.__PRICING__ || {}).tool || '';
  var root = document.documentElement;
  root.classList.add('pt', 'pt-' + tool);

  function $(id) { return document.getElementById(id); }
  function visible(el) { return !!el && el.offsetParent !== null; }
  function text(id) { var el = $(id); return el ? el.textContent.trim() : ''; }

  // ---- status into the tab bar ----
  var tabs = document.querySelector('.tabs');
  var status = $('saveStatus');
  if (tabs && status) {
    status.classList.add('pt-status');
    tabs.appendChild(status);
  }
  function paintStatus() {
    if (!status) return;
    var t = status.textContent || '';
    status.classList.toggle('pt-saved', /^(Saved|Settings loaded)$/.test(t));
    status.classList.toggle('pt-error', /fail/i.test(t));
  }

  // ---- wide screens: Neon / Tapela / Hanger quote in two columns ----
  // Choosing the sign on the left, costs and totals on the right. Only the
  // cards' position changes; they keep their ids and listeners.
  var quote = $('quote-tab');
  if (quote && tool !== 'lightbox') {
    var cards = Array.prototype.slice.call(quote.children);
    var cols = document.createElement('div'), main = document.createElement('div'), side = document.createElement('div');
    cols.className = 'pt-cols'; main.className = 'pt-col-main'; side.className = 'pt-col-side';
    cards.forEach(function (c, i) { (i < 3 ? main : side).appendChild(c); });
    cols.appendChild(main); cols.appendChild(side);
    quote.appendChild(cols);
  }

  // ---- table cell labels (for the phone card layout) ----
  function labelTables() {
    document.querySelectorAll('table').forEach(function (table) {
      var heads = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) {
        return th.textContent.trim().replace(/\s*\(ETB\)$/i, '').replace(/^Unit Price$/i, 'Price').replace(/^(Min|Max) Signage Area \(m²\)$/i, '$1 area m²');
      });
      if (!heads.length) return;
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        var col = 0;
        Array.prototype.forEach.call(tr.children, function (td) {
          var span = td.colSpan || 1;
          if (span === 1 && heads[col] && td.getAttribute('data-label') !== heads[col]) td.setAttribute('data-label', heads[col]);
          col += span;
        });
      });
    });
  }

  // ---- phones: fold long help text, collapse Lightbox catalog rows ----
  var phone = window.matchMedia('(max-width: 700px)');
  var expanded = {};
  function compact() {
    if (!phone.matches) return;
    document.querySelectorAll('.hint').forEach(function (h) {
      if (!h.classList.contains('pt-fold') && h.textContent.trim().length > 140) h.classList.add('pt-fold');
    });
    var body = $('settingsTableBody');
    if (!body) return;
    Array.prototype.forEach.call(body.children, function (tr, i) {
      var btn = tr.querySelector(':scope > .pt-expand');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pt-expand';
        btn.addEventListener('click', function () {
          var idx = Array.prototype.indexOf.call(body.children, tr);
          expanded[idx] = !expanded[idx];
          refresh();
        });
        tr.appendChild(btn);
      }
      var open = !!expanded[i];
      if (tr.classList.contains('pt-collapsed') === open) tr.classList.toggle('pt-collapsed', !open);
      var label = open ? 'Hide extra fields ▴' : 'Show all fields ▾';
      if (btn.textContent !== label) btn.textContent = label;
    });
  }
  document.addEventListener('click', function (e) {
    var h = e.target && e.target.closest ? e.target.closest('.hint.pt-fold') : null;
    if (h) h.classList.toggle('pt-open');
  });

  // ---- sticky bar ----
  var bar = document.createElement('div');
  bar.className = 'pt-bar';
  bar.hidden = true;
  bar.innerHTML = '<div class="pt-bar-total"><small></small><b></b></div><button type="button"></button>';
  var barLabel = bar.querySelector('small'), barValue = bar.querySelector('b'), barBtn = bar.querySelector('button');
  var barTarget = null;
  barBtn.addEventListener('click', function () { if (barTarget && !barTarget.disabled) barTarget.click(); });
  document.body.appendChild(bar);

  function barState() {
    if (tool === 'lightbox') {
      if (visible($('tab-cost'))) {
        return { label: 'Client price', value: text('totalWithProfitDisplay'), btn: '⬇ Invoice', target: $('exportPdfBtn') };
      }
      if (visible($('tab-lightbox'))) {
        var area = $('lbAreaSummary');
        var hasArea = area && area.style.display !== 'none' && area.textContent.trim();
        return { label: 'Next step', value: hasArea ? 'Review materials' : 'Enter the sign size', btn: 'Material Cost →', target: $('applyLightboxBtn') };
      }
      return null;
    }
    if (visible($('quote-tab'))) {
      return { label: 'Grand total', value: text('dispGrandTotal'), btn: '⬇ Invoice', target: $('generateInvoiceBtn') };
    }
    return null;
  }

  function paintBar() {
    var s = barState();
    var modalOpen = ['invoiceModal', 'negotiationModal', 'settingsPwModal'].some(function (id) {
      var m = $(id); return m && m.style.display && m.style.display !== 'none';
    }) || !!document.querySelector('.pricing-pin-scrim');
    if (!s || modalOpen) {
      bar.hidden = true;
      document.body.classList.remove('pt-has-bar');
      root.style.setProperty('--pt-bar-h', '0px');
      return;
    }
    bar.hidden = false;
    var blocked = s.target && s.target.disabled && s.target.title;
    barLabel.textContent = blocked ? s.target.title.replace(/^Before exporting the PDF, please fix:\s*/i, 'Missing: ') : s.label;
    barLabel.classList.toggle('pt-warn', !!blocked);
    barValue.textContent = s.value || '—';
    barBtn.textContent = s.btn;
    barTarget = s.target;
    barBtn.disabled = !s.target || !!s.target.disabled;
    if (s.target && s.target.title) barBtn.title = s.target.title; else barBtn.removeAttribute('title');
    document.body.classList.add('pt-has-bar');
    root.style.setProperty('--pt-bar-h', (bar.offsetHeight + (window.innerWidth > 700 ? 28 : 0)) + 'px');
  }

  // ---- keep everything in step with the tool ----
  var queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      labelTables();
      compact();
      paintBar();
      paintStatus();
    });
  }
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) { if (!bar.contains(records[i].target)) { refresh(); return; } }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'disabled'] });
  document.addEventListener('input', refresh, true);
  document.addEventListener('click', function () { setTimeout(refresh, 0); }, true);
  window.addEventListener('resize', refresh);
  if (phone.addEventListener) phone.addEventListener('change', refresh);
  document.addEventListener('DOMContentLoaded', refresh);
  window.addEventListener('load', refresh);
  refresh();
})();
