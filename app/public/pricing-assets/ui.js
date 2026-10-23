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

  // ---- tabs: a segmented switch inside the crimson header ----
  var tabs = document.querySelector('.tabs');
  if (tabs) {
    var seg = document.createElement('div');
    seg.className = 'pt-seg';
    Array.prototype.slice.call(tabs.querySelectorAll('.tab, .tab-btn')).forEach(function (t) { seg.appendChild(t); });
    tabs.insertBefore(seg, tabs.firstChild);
  }

  // ---- help text on/off (the 💡 button in the app header; off by default) ----
  function setTips(on) { root.classList.toggle('pt-notips', !on); refresh(); }
  // hidden until the owner turns them on
  root.classList.add('pt-notips');
  try { if (window.localStorage.getItem('pricing:tips') === '1') root.classList.remove('pt-notips'); } catch (e) {}
  window.addEventListener('message', function (e) {
    if (e.origin === window.location.origin && e.data && e.data.pt === 'tips') setTips(!!e.data.on);
  });

  // ---- status into the tab bar ----
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
          if (span === 1 && heads[col] && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[col]);
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
    var tip = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (tip) {
      var open = tip.parentElement.querySelector('.pt-tip');
      if (open) { open.remove(); return; }
      var box = document.createElement('div');
      box.className = 'pt-tip';
      box.textContent = tip.getAttribute('data-tip');
      tip.parentElement.appendChild(box);
      return;
    }
    var h = e.target && e.target.closest ? e.target.closest('.hint.pt-fold') : null;
    if (h) h.classList.toggle('pt-open');
  });

  // ---- sticky bar ----
  var bar = document.createElement('div');
  bar.className = 'pt-bar';
  bar.hidden = true;
  bar.innerHTML =
    '<span class="pt-bar-ico"></span>' +
    '<div class="pt-bar-total"><small></small><b></b><em class="pt-bar-warn"></em></div>' +
    '<button type="button" class="pt-bar-2nd"></button>' +
    '<button type="button" class="pt-bar-1st"></button>';
  var barIco = bar.querySelector('.pt-bar-ico'), barLabel = bar.querySelector('small'), barValue = bar.querySelector('b'), barWarn = bar.querySelector('.pt-bar-warn');
  var btn1 = bar.querySelector('.pt-bar-1st'), btn2 = bar.querySelector('.pt-bar-2nd');
  var target1 = null, target2 = null;
  btn1.addEventListener('click', function () { if (target1 && !target1.disabled) target1.click(); });
  btn2.addEventListener('click', function () { if (target2 && !target2.disabled) target2.click(); });
  document.body.appendChild(bar);

  function barState() {
    if (tool === 'lightbox') {
      if (visible($('tab-cost'))) {
        return {
          icon: null, label: 'TOTAL (CLIENT PRICE)', value: text('totalWithProfitDisplay').replace(/\s*ETB$/, ''), unit: 'ETB',
          primary: { text: 'Download Invoice', icon: 'download', target: $('exportPdfBtn') },
          secondary: { text: 'Clear all', icon: 'trash', target: $('resetQtyBtn') }
        };
      }
      if (visible($('tab-lightbox'))) {
        var area = $('lbAreaSummary');
        var hasArea = area && area.style.display !== 'none' && area.textContent.trim();
        return {
          icon: 'clipboard', label: 'Next step', value: hasArea ? 'Review materials' : 'Enter the sign size',
          primary: { text: 'Material Cost', iconAfter: 'arrow', target: $('applyLightboxBtn') }
        };
      }
      return null;
    }
    if (visible($('quote-tab'))) {
      return { icon: 'calculator', label: 'Grand total', value: text('dispGrandTotal'), primary: { text: 'Invoice', icon: 'download', target: $('generateInvoiceBtn') } };
    }
    return null;
  }

  function paintButton(btn, def) {
    if (!def) { btn.hidden = true; return null; }
    btn.hidden = false;
    var icon = window.ptIcon || function () { return ''; };
    var html = (def.icon ? icon(def.icon) : '') + '<span>' + def.text + '</span>' + (def.iconAfter ? icon(def.iconAfter) : '');
    if (btn.innerHTML !== html) btn.innerHTML = html;
    btn.disabled = !def.target || !!def.target.disabled;
    return def.target;
  }

  function paintBar() {
    var s = barState();
    var modalOpen = ['invoiceModal', 'negotiationModal', 'settingsPwModal'].some(function (id) {
      var m = $(id); return m && m.style.display && m.style.display !== 'none';
    }) || !!document.querySelector('.pricing-pin-scrim, .lbx-sheet-scrim');
    if (!s || modalOpen) {
      bar.hidden = true;
      document.body.classList.remove('pt-has-bar');
      root.style.setProperty('--pt-bar-h', '0px');
      return;
    }
    bar.hidden = false;
    var icoHtml = s.icon && window.ptIcon ? window.ptIcon(s.icon) : '';
    if (barIco.innerHTML !== icoHtml) barIco.innerHTML = icoHtml;
    barIco.hidden = !icoHtml;
    var t = s.primary.target;
    var blocked = t && t.disabled && t.title;
    barLabel.textContent = s.label;
    barWarn.textContent = blocked ? t.title.replace(/^Before exporting the PDF, please fix:\s*/i, 'Missing: ').replace(/ \| /g, ', ') : '';
    barWarn.hidden = !blocked;
    var valueHtml = (s.value || '—').replace(/[&<>]/g, '') + (s.unit ? ' <span>' + s.unit + '</span>' : '');
    if (barValue.innerHTML !== valueHtml) barValue.innerHTML = valueHtml;
    target1 = paintButton(btn1, s.primary);
    target2 = paintButton(btn2, s.secondary);
    bar.classList.toggle('pt-bar-has2', !!s.secondary);
    document.body.classList.add('pt-has-bar');
    root.style.setProperty('--pt-bar-h', bar.offsetHeight + 'px');
  }

  // ---- keep everything in step with the tool ----
  var queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      labelTables();
      if (window.ptFillIcons) window.ptFillIcons();
      if (tabs) root.style.setProperty('--pt-tabs-h', tabs.offsetHeight + 'px');
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
