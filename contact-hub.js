/* =====================================================================
   Contact requests - hub side (contact-hub.js)
   Shows everything sent from the public "Get in touch" form (contact.js):
   a Contact requests page, a dashboard card, live alerts, reply/handle tools.
   Needs acacia_contact.sql to be run once in Supabase.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__contactHubLoaded) return; window.__contactHubLoaded = true;
  var TABLE = 'acacia_contact_requests';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function ago(iso) { var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' d ago'; }
  function when(iso) { var d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleString(); }
  function session() { try { return JSON.parse(localStorage.getItem('developerSession') || '{}'); } catch (e) { return {}; } }
  function role() { return session().hubRole || ''; }
  function canAct() { return role() === 'hub_admin' || role() === 'hub_support'; }
  function canDelete() { return role() === 'hub_admin'; }
  function toast(msg, bad) {
    var t = document.createElement('div'); t.className = 'cr-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, bad ? 5000 : 3500);
  }
  function chan(r) { return r.channel || (r.service && !/books/i.test(r.service) ? 'developer' : 'books'); }
  function curMode() { return localStorage.getItem('acacia_dash_mode') === 'books' ? 'books' : 'developer'; }
  var CH_NAME = { books: '📚 Books', developer: '🛠 Developer' };
  function newIn(ch) { return C.rows.filter(function (r) { return r.status === 'new' && (ch === 'all' || chan(r) === ch); }).length; }
  function svc(r) { return r.service || 'General enquiry'; }
  function tagCls(r) { return /books/i.test(r.service || '') ? ' books' : ''; }

  var C = { rows: [], loaded: false, err: null, filter: 'new', ch: curMode(), svc: 'all', q: '', seen: null, busy: false, last: 0, subscribed: false };
  var sb = function () { return window.__acxSb; };

  function css() {
    var s = document.createElement('style');
    s.textContent = '.cr-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:14px;color:#111827}.cr-card h3{margin:0;font-size:16px;font-weight:700}.cr-ch{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}.cr-mut{color:#6b7280;font-size:12px}.cr-b{border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:500;cursor:pointer}.cr-b:hover{background:#f3f4f6}.cr-b.pri{background:#22615D;border-color:#22615D;color:#fff}.cr-b.dng{color:#b91c1c;border-color:#fecaca}.cr-b.sm{padding:3px 9px;font-size:12px}.cr-b:disabled{opacity:.5}.cr-list{list-style:none;margin:0;padding:0}.cr-list li{display:flex;gap:10px;align-items:flex-start;padding:9px 6px;border-bottom:1px solid #f1f5f9;cursor:pointer;border-radius:8px}.cr-list li:hover{background:rgba(34,97,93,.07)}.cr-dot{width:10px;height:10px;border-radius:50%;margin-top:5px;flex:0 0 10px;background:#9ca3af}.cr-dot.new{background:#dc2626}.cr-dot.handled{background:#16a34a}.cr-tag{display:inline-block;background:#e0f2f1;color:#22615D;border-radius:99px;padding:1px 9px;font-size:11px;font-weight:700}.cr-tag.books{background:#dcfce7;color:#166534}.cr-badge{display:inline-block;background:#dc2626;color:#fff;border-radius:99px;font-size:11px;font-weight:700;padding:1px 8px;margin-left:6px}.cr-badge.zero{background:#9ca3af}.cr-chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px;align-items:center}.cr-chip{border:1px solid #d1d5db;background:#fff;border-radius:99px;padding:3px 12px;font-size:12px;font-weight:600;color:#4b5563;cursor:pointer}.cr-chip.on{background:#22615D;border-color:#22615D;color:#fff}.cr-t{width:100%;border-collapse:collapse;font-size:14px}.cr-t th{text-align:left;font-size:12px;color:#6b7280;padding:8px;border-bottom:1px solid #e5e7eb}.cr-t td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.cr-t tr.row{cursor:pointer}.cr-t tr.row:hover{background:rgba(34,97,93,.06)}.cr-in{border:1px solid #d1d5db;border-radius:8px;padding:6px 10px;font-size:13px;background:#fff;color:#111827}.cr-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}.cr-md{background:#fff;color:#111827;border-radius:14px;padding:20px;width:100%;max-width:620px;max-height:92vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)}.cr-md h3{margin:0 0 4px;font-size:18px}.cr-msg{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:14px;margin:10px 0;max-height:34vh;overflow:auto}.cr-kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:13px;margin:8px 0}.cr-kv span:nth-child(odd){color:#6b7280}.cr-md textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:8px;font-size:13px;min-height:70px;background:#fff;color:#111827}.cr-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cr-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#0E2B29;color:#fff;padding:10px 18px;border-radius:10px;z-index:100002;font-size:13px;transition:opacity .4s;max-width:90vw}.cr-toast.bad{background:#991b1b}.cr-toast.out{opacity:0}.cr-err{color:#b91c1c;font-size:13px}body.dark-mode .cr-card,body.dark-mode .cr-md{background:#0F201F;border-color:#1c2f2d;color:#e5e7eb}body.dark-mode .cr-b,body.dark-mode .cr-chip{background:#0A1615;border-color:#1c2f2d;color:#e5e7eb}body.dark-mode .cr-b.pri,body.dark-mode .cr-chip.on{background:#22615D;color:#fff}body.dark-mode .cr-in,body.dark-mode .cr-md textarea{background:#0A1615;border-color:#1c2f2d;color:#e5e7eb}body.dark-mode .cr-msg{background:#0A1615;border-color:#1c2f2d}body.dark-mode .cr-t td,body.dark-mode .cr-t th,body.dark-mode .cr-list li{border-color:#1c2f2d}';
    document.head.appendChild(s);
  }

  async function load(quiet) {
    var c = sb(); if (!c || C.busy) return; C.busy = true;
    try {
      var r = await c.from(TABLE).select('*').order('created_at', { ascending: false }).limit(500);
      if (r.error) throw r.error;
      var prev = C.seen; C.rows = r.data || []; C.err = null; C.loaded = true; C.last = Date.now();
      var ids = {}; C.rows.forEach(function (x) { ids[x.id] = 1; });
      if (prev && quiet) { var fresh = C.rows.filter(function (x) { return !prev[x.id] && x.status === 'new'; }); if (fresh.length) toast('📨 New ' + (chan(fresh[0]) === 'books' ? 'Books' : 'Developer') + ' request from ' + fresh[0].name + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' more)' : '')); }
      C.seen = ids; subscribe();
    } catch (e) { C.err = e; C.loaded = true; }
    C.busy = false; renderAll();
  }
  function subscribe() {
    var c = sb(); if (C.subscribed || !c || !c.channel) return; C.subscribed = true;
    try { c.channel('acx-contact-requests').on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, function () { load(true); }).subscribe(); } catch (e) { }
  }
  function newCount() { return newIn('all'); }
  function missing() { var m = String(C.err && C.err.message || C.err || ''); return /does not exist|schema cache|relation|Could not find/i.test(m); }
  function renderAll() { renderBadge(); renderHome(); renderPage(); }
  function renderBadge() { var b = $('crBadge'); if (!b) return; var n = newCount(); b.textContent = n; b.style.display = n ? '' : 'none'; b.title = 'Books: ' + newIn('books') + ' new · Developer: ' + newIn('developer') + ' new'; }

  /* ---- dashboard card: shown in BOTH Developer and Books modes ---- */
  function renderHome() {
    var el = $('crHome'); if (!el) return;
    var mode = curMode(), mine = newIn(mode), other = newIn(mode === 'books' ? 'developer' : 'books');
    var h = '<div class="cr-card"><div class="cr-ch"><h3>📨 ' + (mode === 'books' ? 'Books enquiries' : 'Developer enquiries') + (C.loaded && !C.err ? '<span class="cr-badge' + (mine ? '' : ' zero') + '">' + mine + ' new</span>' : '') + '</h3><button class="cr-b sm" data-cr="page" data-ch="' + mode + '">View all →</button></div>' + (C.loaded && !C.err ? '<div class="cr-mut" style="margin:-4px 0 6px">' + (mode === 'books' ? 'Developer enquiries' : 'Books enquiries') + ': ' + other + ' new <a data-cr="page" data-ch="' + (mode === 'books' ? 'developer' : 'books') + '" style="color:#22615D;cursor:pointer">open →</a></div>' : '');
    if (!C.loaded) h += '<p class="cr-mut">Loading…</p>';
    else if (C.err) h += '<p class="cr-mut">' + (missing() ? 'Run <code>acacia_contact.sql</code> once in Supabase → SQL Editor to start receiving “Get in touch” requests here.' : esc(C.err.message || C.err)) + '</p>';
    else {
      var list = C.rows.filter(function (r) { return r.status !== 'spam' && chan(r) === mode; }).slice(0, 5);
      h += list.length ? '<ul class="cr-list">' + list.map(function (r) { return '<li data-cr="open" data-id="' + r.id + '"><span class="cr-dot ' + r.status + '"></span><div style="flex:1;min-width:0"><b>' + esc(r.name) + '</b> <span class="cr-tag' + tagCls(r) + '">' + esc(svc(r)) + '</span><div class="cr-mut" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.message.replace(/\s+/g, ' ').slice(0, 110)) + '</div></div><span class="cr-mut">' + ago(r.created_at) + '</span></li>'; }).join('') + '</ul>' : '<p class="cr-mut">No ' + (mode === 'books' ? 'Books' : 'developer') + ' enquiries yet.</p>';
    }
    el.innerHTML = h + '</div>';
  }

  /* ---- full page ---- */
  function filtered() {
    var q = C.q.toLowerCase();
    return C.rows.filter(function (r) {
      if (C.ch !== 'all' && chan(r) !== C.ch) return false;
      if (C.filter !== 'all' && r.status !== C.filter) return false;
      if (C.svc !== 'all' && svc(r) !== C.svc) return false;
      return !q || (r.name + ' ' + r.email + ' ' + (r.phone || '') + ' ' + r.message + ' ' + r.ref + ' ' + svc(r)).toLowerCase().indexOf(q) >= 0;
    });
  }
  function counts(st) { return C.rows.filter(function (r) { return (C.ch === 'all' || chan(r) === C.ch) && (st === 'all' || r.status === st); }).length; }
  function renderPage() {
    var el = $('crRoot'), pg = $('contacts'); if (!el || !pg || !pg.classList.contains('active')) return;
    var h = '<div class="cr-ch" style="margin-bottom:12px"><div><h1 style="font-size:22px;font-weight:700;margin:0">📨 Contact requests</h1><span class="cr-mut">Everything sent from your “Get in touch” form.</span></div><div style="display:flex;gap:8px"><button class="cr-b" data-cr="csv">⬇ Export CSV</button><button class="cr-b" data-cr="refresh">⟳ Refresh</button></div></div>';
    if (!C.loaded) { el.innerHTML = h + '<p class="cr-mut">Loading…</p>'; return; }
    if (C.err) { el.innerHTML = h + '<div class="cr-card">' + (missing() ? '<h3>One-time setup needed</h3><p>Open Supabase → <b>SQL Editor</b>, paste the contents of <code>acacia_contact.sql</code> and press <b>Run</b>, then press Refresh.</p>' : '<p class="cr-err">' + esc(C.err.message || C.err) + '</p>') + '</div>'; return; }
    var kinds = {}; C.rows.forEach(function (r) { if (C.ch === 'all' || chan(r) === C.ch) kinds[svc(r)] = 1; });
    h += '<div class="cr-chips" style="margin-bottom:4px">' + [['books', CH_NAME.books], ['developer', CH_NAME.developer], ['all', 'All']].map(function (c) { var n = newIn(c[0]); return '<button class="cr-chip' + (C.ch === c[0] ? ' on' : '') + '" data-cr="chan" data-ch="' + c[0] + '" style="font-size:13px;padding:5px 16px">' + c[1] + (n ? ' <span class="cr-badge" style="margin-left:4px">' + n + '</span>' : '') + '</button>'; }).join('') + '</div>';
    h += '<div class="cr-chips">' + [['new', 'New'], ['handled', 'Handled'], ['spam', 'Spam'], ['all', 'All']].map(function (c) { return '<button class="cr-chip' + (C.filter === c[0] ? ' on' : '') + '" data-cr="chip" data-f="' + c[0] + '">' + c[1] + ' (' + counts(c[0]) + ')</button>'; }).join('') + '<select class="cr-in" id="crSvc"><option value="all">All services</option>' + Object.keys(kinds).sort().map(function (k) { return '<option value="' + esc(k) + '"' + (C.svc === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select><input class="cr-in" id="crQ" placeholder="Search name, email, message…" value="' + esc(C.q) + '"></div>';
    var rows = filtered();
    h += '<div class="cr-card" style="padding:6px 12px"><div style="overflow-x:auto"><table class="cr-t"><thead><tr><th>Received</th><th>From</th><th>Needs</th><th>Message</th><th>Status</th></tr></thead><tbody>' + (rows.length ? rows.map(function (r) {
      return '<tr class="row" data-cr="open" data-id="' + r.id + '"><td class="cr-mut" style="white-space:nowrap">' + ago(r.created_at) + '<br>' + esc(r.ref) + '</td><td><b>' + esc(r.name) + '</b><div class="cr-mut">' + esc(r.email) + (r.phone ? '<br>' + esc(r.phone) : '') + (r.contact_via ? '<br>Prefers ' + esc(r.contact_via) : '') + '</div></td><td><span class="cr-tag' + tagCls(r) + '">' + (C.ch === 'all' ? (chan(r) === 'books' ? '📚 ' : '🛠 ') : '') + esc(svc(r)) + '</span>' + (r.budget || r.timeline ? '<div class="cr-mut">' + esc([r.budget, r.timeline].filter(Boolean).join(' · ')) + '</div>' : '') + '</td><td style="max-width:360px">' + esc(r.message.replace(/\s+/g, ' ').slice(0, 140)) + (r.message.length > 140 ? '…' : '') + '</td><td><span class="cr-dot ' + r.status + '" style="display:inline-block;margin-right:6px"></span>' + esc(r.status) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="cr-mut" style="padding:20px">Nothing here.</td></tr>') + '</tbody></table></div></div>';
    var keepQ = document.activeElement && document.activeElement.id === 'crQ';
    el.innerHTML = h; if (keepQ) { var q = $('crQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  /* ---- detail modal ---- */
  function waLink(p) { var d = String(p || '').replace(/\D/g, ''); return d.length >= 8 ? 'https://wa.me/' + d : ''; }
  function openRequest(id) {
    var r = C.rows.filter(function (x) { return x.id === id; })[0]; if (!r) return;
    var d = document.createElement('div'); d.className = 'cr-ov';
    var subj = 'Re: your enquiry (' + r.ref + ')', body = 'Hi ' + r.name.split(' ')[0] + ',\n\nThank you for getting in touch about ' + svc(r).toLowerCase() + '.\n\n\n\n' + (session().fullName ? '— ' + session().fullName + '\n\n' : '') + '> ' + r.message.replace(/\n/g, '\n> ');
    var mail = 'mailto:' + r.email + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body), wa = waLink(r.phone), act = canAct(), pref = r.contact_via || 'Email';
    var btnMail = '<a class="cr-b' + (pref === 'Email' ? ' pri' : '') + '" data-acxmail="1" href="' + esc(mail) + '" style="text-decoration:none">✉ Reply by email</a>';
    var btnWa = wa ? '<a class="cr-b' + (pref === 'WhatsApp' ? ' pri' : '') + '" href="' + wa + '" target="_blank" rel="noopener" style="text-decoration:none">💬 WhatsApp</a>' : '';
    var btnTel = r.phone ? '<a class="cr-b' + (pref === 'Phone call' ? ' pri' : '') + '" href="tel:' + esc(r.phone.replace(/[^\d+]/g, '')) + '" style="text-decoration:none">📞 Call</a>' : '';
    d.innerHTML = '<div class="cr-md"><h3>' + esc(r.name) + ' <span class="cr-tag' + tagCls(r) + '">' + esc(svc(r)) + '</span></h3><div class="cr-mut">' + (chan(r) === 'books' ? '📚 Books' : '🛠 Developer') + ' · ' + esc(r.ref) + ' · ' + when(r.created_at) + '</div>' +
      '<div class="cr-kv"><span>Email</span><span><a data-acxmail="1" href="' + esc(mail) + '">' + esc(r.email) + '</a></span><span>Phone</span><span>' + (r.phone ? esc(r.phone) : '-') + '</span><span>Prefers</span><span>' + esc(pref) + '</span><span>Budget</span><span>' + esc(r.budget || '-') + '</span><span>Timeline</span><span>' + esc(r.timeline || '-') + '</span><span>Status</span><span>' + esc(r.status) + (r.handled_by ? ' · ' + esc(r.handled_by) + ' · ' + when(r.handled_at) : '') + '</span>' + (r.source_url ? '<span>Sent from</span><span style="word-break:break-all">' + esc(r.source_url) + '</span>' : '') + '</div>' +
      '<div class="cr-msg">' + esc(r.message) + '</div><label class="cr-mut">Internal notes (only you see these)</label><textarea id="crNotes"' + (act ? '' : ' readonly') + '>' + esc(r.notes || '') + '</textarea>' +
      '<div class="cr-act">' + (pref === 'Email' ? btnMail + btnWa + btnTel : pref === 'WhatsApp' ? btnWa + btnMail + btnTel : btnTel + btnWa + btnMail) + '</div>' +
      '<div class="cr-act">' + (act ? (r.status === 'handled' ? '<button class="cr-b" data-s="new">Reopen</button>' : '<button class="cr-b" data-s="handled">✓ Mark handled</button>') + (r.status !== 'spam' ? '<button class="cr-b" data-s="spam">Spam</button>' : '<button class="cr-b" data-s="new">Not spam</button>') + '<button class="cr-b" data-s="notes">Save notes</button>' : '') + (canDelete() ? '<button class="cr-b dng" data-s="del">Delete</button>' : '') + '<button class="cr-b" data-s="close" style="margin-left:auto">Close</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', async function (e) {
      var am = e.target.closest && e.target.closest('a[data-acxmail]'); if (am && typeof window.acxMailTo === 'function') { e.preventDefault(); window.acxMailTo({ to: r.email, subject: subj, body: body }); return; }
      if (e.target === d) return d.remove(); var b = e.target.closest('[data-s]'); if (!b) return; var a = b.dataset.s;
      if (a === 'close') return d.remove();
      b.disabled = true;
      try {
        if (a === 'del') { if (!confirm('Delete this request permanently?')) { b.disabled = false; return; } var x = await sb().from(TABLE).delete().eq('id', r.id); if (x.error) throw x.error; C.rows = C.rows.filter(function (y) { return y.id !== r.id; }); toast('Deleted'); }
        else {
          var upd = { notes: ($('crNotes').value || '').trim() || null };
          if (a !== 'notes') { upd.status = a; upd.handled_by = session().fullName || session().email || 'hub'; upd.handled_at = new Date().toISOString(); }
          var u = await sb().from(TABLE).update(upd).eq('id', r.id).select().maybeSingle(); if (u.error) throw u.error;
          if (!u.data) throw new Error('Not saved: you may not have permission to update requests.');
          Object.assign(r, u.data); toast(a === 'notes' ? 'Notes saved' : 'Marked ' + a);
        }
        d.remove(); renderAll();
      } catch (er) { b.disabled = false; toast(er.message || String(er), true); }
    });
  }
  function exportCsv() {
    var rows = filtered(), q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var csv = ['Reference,Channel,Received,Name,Email,Phone,Prefers,Service,Budget,Timeline,Status,Message'].concat(rows.map(function (r) { return [r.ref, chan(r), r.created_at, r.name, r.email, r.phone, r.contact_via, r.service, r.budget, r.timeline, r.status, r.message].map(q).join(','); })).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'contact-requests.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function onClick(e) {
    var t = e.target.closest('[data-cr]'); if (!t) return; var a = t.dataset.cr;
    if (a === 'open') return openRequest(t.dataset.id);
    if (a === 'page') { if (t.dataset.ch) { C.ch = t.dataset.ch; C.filter = 'new'; C.svc = 'all'; } return window.openPage('contacts'); }
    if (a === 'chan') { C.ch = t.dataset.ch; C.svc = 'all'; return renderPage(); }
    if (a === 'chip') { C.filter = t.dataset.f; return renderPage(); }
    if (a === 'refresh') { C.loaded = false; renderPage(); return load(false); }
    if (a === 'csv') return exportCsv();
  }

  function mount() {
    if ($('contacts')) return true; var anchor = $('support') || $('websites'); if (!anchor) return false;
    css();
    var page = document.createElement('div'); page.className = 'page p-4 sm:p-6'; page.id = 'contacts'; page.innerHTML = '<div id="crRoot"></div>';
    anchor.insertAdjacentElement('afterend', page);
    page.addEventListener('click', onClick);
    page.addEventListener('input', function (e) { if (e.target.id === 'crQ') { C.q = e.target.value; renderPage(); } });
    page.addEventListener('change', function (e) { if (e.target.id === 'crSvc') { C.svc = e.target.value; renderPage(); } });
    var nb = document.querySelector('button[onclick*="openPage(\'support\')"]') || document.querySelector('button[onclick*="openPage(\'websites\')"]'), li = nb && nb.closest('li');
    if (li) { var n = document.createElement('li'); n.innerHTML = '<button onclick="openPage(\'contacts\')">📨 Contact requests <span id="crBadge" class="cr-badge" style="display:none"></span></button>'; li.insertAdjacentElement('afterend', n); }
    return true;
  }
  function mountHome(tries) {
    if ($('crHome')) return; var dash = $('dashboard'); if (!dash) return;
    var sw = $('stSwitch'), hdr = dash.querySelector('h1'); hdr = hdr && hdr.closest('#dashboard > div');
    if (!sw && tries < 6) return setTimeout(function () { mountHome(tries + 1); }, 300);   /* wait briefly for the Studio switch */
    var el = document.createElement('div'); el.id = 'crHome'; el.addEventListener('click', onClick);
    if (sw) sw.insertAdjacentElement('afterend', el); else if (hdr) hdr.insertAdjacentElement('afterend', el); else dash.insertBefore(el, dash.firstChild);
    renderHome();
  }

  function init() {
    if (!mount()) return setTimeout(init, 300);
    mountHome(0);
    window.addEventListener('acx-dash-mode', function (e) { C.ch = e.detail === 'books' ? 'books' : 'developer'; C.filter = 'new'; C.svc = 'all'; renderAll(); });
    var _op = window.openPage;
    window.openPage = function (id) { var r = _op.apply(this, arguments); if (id === 'contacts') { renderPage(); load(false); } return r; };
    var _ld = window.loadDashboard;
    if (typeof _ld === 'function') window.loadDashboard = function () { var r = _ld.apply(this, arguments); if (Date.now() - C.last > 30000 && sb() && localStorage.getItem('developerSession')) load(true); return r; };
    setInterval(function () { if (localStorage.getItem('developerSession') && sb() && !document.hidden) load(true); }, 60000);
    var tries = 0; (function first() { if (sb() && localStorage.getItem('developerSession')) load(false); else if (tries++ < 20) setTimeout(first, 1500); })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
