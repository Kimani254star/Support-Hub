/* Support panel: Releases (new-module notes) + Webinars. Loaded after script.js. */
(function(){
  var sb = function(){ return window.__acxSb; };
  var can = function(){ return !window.__acxCanWrite || window.__acxCanWrite(); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var who = function(){ try { return JSON.parse(localStorage.getItem('developerSession') || '{}').fullName || 'Developer'; } catch(e){ return 'Developer'; } };
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var R = [], W = [], CO = [], REG = {};
  var B = 'px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  var P = 'px-4 py-2.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700';
  var I = 'w-full p-2 border border-gray-300 rounded text-sm bg-white';
  var fmt = function(d){ return d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'; };
  var loc = function(iso){ var d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  var field = function(l, h){ return '<label class="block text-xs font-semibold text-gray-600 mb-1 mt-3">' + l + '</label>' + h; };
  var pill = function(t, c){ return '<span class="text-xs font-semibold px-2 py-0.5 rounded-full ' + c + '">' + esc(t) + '</span>'; };

  function modal(title, body, onSave, saveLabel){
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px';
    o.innerHTML = '<div class="bg-white rounded-xl shadow-2xl w-full flex flex-col" style="max-width:560px;max-height:90vh"><div class="p-4 border-b border-gray-200 font-bold text-lg">' + title + '</div><div class="p-4 overflow-y-auto" style="flex:1">' + body + '</div><div class="p-3 border-t border-gray-200 flex justify-end gap-2"><button class="' + B + '" data-x>Close</button>' + (onSave ? '<button class="' + P + '" data-ok>' + (saveLabel || 'Save') + '</button>' : '') + '</div></div>';
    document.body.appendChild(o);
    var close = function(){ o.remove(); };
    o.addEventListener('click', function(e){ if (e.target === o || e.target.hasAttribute('data-x')) close(); });
    var ok = $('[data-ok]', o);
    if (ok) ok.onclick = async function(){ ok.disabled = true; var r = await onSave(o); ok.disabled = false; if (r !== false) close(); };
    return o;
  }
  function audience(prefix, sel){
    return field('Audience', '<select id="' + prefix + 'aud" class="' + I + '"><option value="all">All companies</option><option value="some"' + (sel && sel.length ? ' selected' : '') + '>Selected companies</option></select>') +
      '<select id="' + prefix + 'cos" multiple size="5" class="' + I + ' mt-2" style="display:' + (sel && sel.length ? 'block' : 'none') + '">' +
      CO.map(function(c){ return '<option value="' + esc(c.company_id) + '"' + (sel && sel.indexOf(c.company_id) > -1 ? ' selected' : '') + '>' + esc(c.company_name || c.company_id) + '</option>'; }).join('') + '</select>';
  }
  function bindAud(o, p){ var a = $('#' + p + 'aud', o); a.onchange = function(){ $('#' + p + 'cos', o).style.display = a.value === 'some' ? 'block' : 'none'; }; }
  function readAud(o, p){ if ($('#' + p + 'aud', o).value === 'all') return null; var v = Array.from($('#' + p + 'cos', o).selectedOptions).map(function(x){ return x.value; }); return v.length ? v : null; }
  function aud(ids){ return ids && ids.length ? ids.length + ' compan' + (ids.length > 1 ? 'ies' : 'y') : 'All companies'; }
  async function loadCo(){ if (CO.length || !sb()) return; var r = await sb().from('acacia_company_status').select('company_id,company_name,email'); CO = r.data || []; }
  var url = function(u){ u = (u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; };
  function fail(r, what){ if (r.error){ alert('Could not ' + what + ': ' + r.error.message + (/relation|policy|permission/i.test(r.error.message) ? '\n\nRun acacia_announcements_webinars.sql in Supabase and sign in as hub admin.' : '')); return true; } return false; }
  function mailTo(targets, subject, body){
    if (!targets.length) return alert('No companies to email.');
    if (!confirm('Save a draft in Acacia Mail for ' + targets.length + ' compan' + (targets.length > 1 ? 'ies' : 'y') + '?')) return;
    targets.forEach(function(c){ window.acxMailTo({ companyId: c.company_id, company: c.company_name, to: c.email || '', subject: subject, body: body }); });
  }
  var targets = function(ids){ return CO.filter(function(c){ return !ids || !ids.length || ids.indexOf(c.company_id) > -1; }); };

  /* ---------- Releases ---------- */
  function shellR(){ $('#releases').innerHTML = '<div class="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-5 mb-6"><div><h1 class="text-3xl font-extrabold text-gray-900">Releases</h1><p class="mt-2 text-sm text-gray-500">Tracks module changes only (new, updated or removed modules) across the Acacia apps. Write a release note from a detected change, then create its training from Webinars. Published notes appear in the Books "What\'s new" bell.</p></div><div class="flex gap-2 mt-4 md:mt-0"><button class="' + P + '" onclick="acxRel.edit()">➕ New release note</button><button class="' + B + '" onclick="acxRel.load()">🔄 Refresh</button><button class="' + B + '" onclick="acxRel.scan()">🔍 Check modules for changes</button></div></div><div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm"><table class="w-full text-left text-sm min-w-[800px]"><thead><tr class="bg-gray-50 text-xs uppercase text-gray-600"><th class="p-4">Title</th><th class="p-4">Module</th><th class="p-4">Audience</th><th class="p-4">Status</th><th class="p-4">Published</th><th class="p-4 text-right">Actions</th></tr></thead><tbody id="relBody" class="divide-y divide-gray-100"></tbody></table></div>'; }
  async function loadR(){
    if (!$('#relBody')) shellR();
    await loadCo();
    var r = await sb().from('acacia_announcements').select('*').order('created_at', { ascending: false });
    if (fail(r, 'load release notes')) return;
    R = r.data || [];
    $('#relBody').innerHTML = R.length ? R.map(function(a){
      return '<tr><td class="p-4 font-medium">' + (a.pinned ? '📌 ' : '') + esc(a.title) + '</td><td class="p-4">' + esc(a.module || '-') + '</td><td class="p-4">' + aud(a.company_ids) + '</td><td class="p-4">' + pill(a.status, a.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700') + '</td><td class="p-4">' + fmt(a.published_at) + '</td><td class="p-4 text-right whitespace-nowrap"><button class="' + B + '" onclick="acxRel.edit(\'' + a.id + '\')">Edit</button> <button class="' + B + '" onclick="acxRel.toggle(\'' + a.id + '\')">' + (a.status === 'published' ? 'Unpublish' : 'Publish') + '</button> <button class="' + B + '" onclick="acxRel.mail(\'' + a.id + '\')">✉️ Email</button> <button class="' + B + ' text-rose-600" onclick="acxRel.del(\'' + a.id + '\')">Delete</button></td></tr>';
    }).join('') : '<tr><td colspan="6" class="p-8 text-center text-gray-500">No release notes yet.</td></tr>';
    loadChanges();
    scanApps(false).then(function(x){ if (x && x.changed) loadChanges(); });
  }
  /* ---------- Module tracking (runs here in Support) ----------
     Only MODULES are tracked: each app's sidebar is read, every module (a hub or a page inside a hub) is
     snapshotted, and a new / updated / removed module is flagged. "Write release note" opens pre-filled. */
  var APPS = window.__ACX_APPS__ || [
    { k: 'books',    name: 'Books',     url: window.__BOOKS_URL__ || 'https://acacia-books.vercel.app/' },
    { k: 'crm',      name: 'CRM',       url: 'https://acacia-crm.vercel.app/' },
    { k: 'sales',    name: 'Sales Hub', url: 'https://sales-xi-cyan.vercel.app/' },
    { k: 'expenses', name: 'Expense',   url: 'https://expenses-jade-xi.vercel.app/' },
    { k: 'payroll',  name: 'Payroll',   url: 'https://payroll-gamma.vercel.app/' },
    { k: 'project',  name: 'Project',   url: 'https://project-hub-gamma-woad.vercel.app/' }
  ];
  var appName = function(k){ var a = APPS.find(function(x){ return x.k === k; }); return a ? a.name : k; };
  async function sha(str){
    try { if (window.crypto && crypto.subtle) { var h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.prototype.map.call(new Uint8Array(h), function(b){ return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 24); } } catch(e){}
    var a = 5381, b = 52711; for (var k = 0; k < str.length; k++) { var c = str.charCodeAt(k); a = ((a * 33) ^ c) >>> 0; b = ((b * 31) + c) >>> 0; } /* fallback when crypto.subtle is unavailable (non-HTTPS) */
    return 'f' + a.toString(16) + b.toString(16) + str.length.toString(16);
  }
  var cleanLabel = function(b){ return (b.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+/u, ''); };
  /* sidebar -> [{key, name, hub, sig, detail}] */
  async function extractModules(doc){
    var nav = doc.querySelector('#sidebar') || doc.querySelector('.sidebar') || doc.querySelector('aside') || doc.querySelector('nav');
    if (!nav) return [];
    var hubOf = {}, out = [], seen = {};
    nav.querySelectorAll('[onclick*="toggleSubmenu"]').forEach(function(b){ var m = /toggleSubmenu\(\s*['"]([^'"]+)/.exec(b.getAttribute('onclick') || ''); if (m) hubOf[m[1]] = cleanLabel(b); });
    var btns = Array.prototype.slice.call(nav.querySelectorAll('button,a'));
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i], oc = b.getAttribute('onclick') || '', href = b.getAttribute('href') || '';
      var m = /(?:showTab|openPage|showPage|showSection|switchTab|openTab|showView|navigate)\(\s*['"]([^'"]+)['"]/.exec(oc);
      var key = m ? m[1] : (b.getAttribute('data-tab') || b.getAttribute('data-page') || b.getAttribute('data-target') || (/^#[\w-]+$/.test(href) ? href.slice(1) : ''));
      if (!key || seen[key]) continue;
      var name = cleanLabel(b); if (!name || /^(log ?out|sign out)$/i.test(name)) continue;
      seen[key] = 1;
      var sub = b.closest('ul[id]'), panel = doc.getElementById(key), detail = {}, sig = null;
      if (panel) {
        sig = await sha(panel.outerHTML.replace(/\s+/g, ' '));
        var bs = {}; Array.prototype.forEach.call(panel.querySelectorAll('button'), function(x){ var t = cleanLabel(x); if (t.length > 1 && t.length < 34 && !/^(options|close|cancel|save|ok|yes|no|edit|view|delete|bulk delete|search|filter|clear|reset|apply|back|next|previous|more)$/i.test(t)) bs[t] = 1; });
        detail.buttons = Object.keys(bs).slice(0, 8);
        detail.headings = Array.prototype.map.call(panel.querySelectorAll('h1,h2,h3'), cleanLabel).filter(Boolean).slice(0, 3);
      }
      out.push({ key: key, name: name, hub: (sub && hubOf[sub.id]) || name, sig: sig, detail: detail });
    }
    return out;
  }
  async function scanApps(manual){
    if (!sb() || !can()) { if (manual) alert('Only the hub admin can check for module changes.'); return { skipped: true }; }
    var TK = 'acx_mod_scan_t';
    if (!manual && Date.now() - Number(localStorage.getItem(TK) || 0) < 6 * 3600000) return { skipped: true };
    var sn = await sb().from('acacia_module_snapshot').select('app,key,sig');
    if (sn.error) { if (manual) alert('Could not check modules: ' + sn.error.message + (/relation|policy|permission/i.test(sn.error.message) ? '\n\nRun acacia_module_tracking.sql in Supabase.' : '')); return { error: true }; }
    var res = { changed: 0, baseline: [], failed: [], ok: [] }, now = new Date().toISOString();
    for (var i = 0; i < APPS.length; i++) {
      var app = APPS[i];
      try {
        var ir = await fetch(app.url, { cache: 'no-store' }); if (!ir.ok) throw new Error('returned ' + ir.status);
        var doc = new DOMParser().parseFromString(await ir.text(), 'text/html');
        var mods = await extractModules(doc);
        if (!mods.length) throw new Error('no sidebar modules found');
        var known = {}, had = 0; (sn.data || []).forEach(function(x){ if (x.app === app.k) { known[x.key] = x.sig; had++; } });
        var changes = [], cur = {};
        mods.forEach(function(mo){
          cur[mo.key] = 1;
          if (!had) return;
          if (!(mo.key in known)) changes.push({ app: app.k, key: mo.key, hub: mo.hub, name: mo.name, kind: 'added', detail: mo.detail, seen_at: now, status: 'new' });
          else if (mo.sig && known[mo.key] && known[mo.key] !== mo.sig) changes.push({ app: app.k, key: mo.key, hub: mo.hub, name: mo.name, kind: 'updated', detail: mo.detail, seen_at: now, status: 'new' });
        });
        if (had) Object.keys(known).forEach(function(k){ if (!cur[k]) changes.push({ app: app.k, key: k, hub: '', name: k, kind: 'removed', detail: {}, seen_at: now, status: 'new' }); });
        if (changes.length) { var ins = await sb().from('acacia_module_changes').insert(changes); if (ins.error) throw ins.error; res.changed += changes.length; }
        var up = await sb().from('acacia_module_snapshot').upsert(mods.map(function(mo){ return { app: app.k, key: mo.key, hub: mo.hub, name: mo.name, sig: mo.sig, checked_at: now }; }), { onConflict: 'app,key' }); if (up.error) throw up.error;
        var gone = Object.keys(known).filter(function(k){ return !cur[k]; });
        if (gone.length) await sb().from('acacia_module_snapshot').delete().eq('app', app.k).in('key', gone);
        (had ? res.ok : res.baseline).push(app.name);
      } catch(e){ console.warn('[Releases] scan failed for ' + app.name, e); res.failed.push(app.name + ' (' + (e.message || e) + ')'); }
    }
    localStorage.setItem(TK, String(Date.now()));
    return res;
  }
  var CH = [], SNAP = [];
  async function loadChanges(){
    var host = $('#relBody') && $('#relBody').closest('.overflow-x-auto'); if (!host) return;
    var box = $('#relChanges'); if (!box) { box = document.createElement('div'); box.id = 'relChanges'; host.parentNode.insertBefore(box, host); }
    var r = await sb().from('acacia_module_changes').select('*').eq('status', 'new').order('seen_at', { ascending: false }).limit(300);
    if (r.error) { box.innerHTML = /relation|permission|policy/i.test(r.error.message) ? '<p class="text-xs text-gray-400 mb-3">Module tracking is off. Run acacia_module_tracking.sql in Supabase to turn it on.</p>' : ''; return; }
    var sn = await sb().from('acacia_module_snapshot').select('app,key,name'); SNAP = sn.data || [];
    var g = {}; (r.data || []).forEach(function(x){ var k = x.seen_at + '|' + x.app; (g[k] = g[k] || { at: x.seen_at, app: x.app, rows: [] }).rows.push(x); });
    CH = Object.keys(g).map(function(k){ return g[k]; });
    var ico = { added: '＋ New', updated: '✎ Updated', removed: '✕ Removed' };
    box.innerHTML = CH.length ? '<div class="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50"><div class="font-bold text-amber-900 mb-2">⚠ Modules changed — not announced yet</div>' + CH.map(function(c, i){
      return '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2 border-t border-amber-200"><div><div class="text-sm font-semibold text-gray-800">' + esc(appName(c.app)) + ' · ' + fmt(c.at) + '</div><div class="text-xs text-gray-700">' + c.rows.map(function(x){ return ico[x.kind] + ': ' + esc((x.hub && x.hub !== x.name ? x.hub + ' › ' : '') + x.name); }).join('<br>') + '</div></div><div class="whitespace-nowrap"><button class="' + P + '" onclick="acxRel.write(' + i + ')">Write release note</button> <button class="' + B + '" onclick="acxRel.chDone(' + i + ')">Mark done</button></div></div>';
    }).join('') + '</div>' : '';
  }
  /* other apps where a module with the same name exists */
  function alsoIn(app, name){
    var n = String(name || '').toLowerCase(), set = {};
    SNAP.forEach(function(x){ if (x.app !== app && String(x.name || '').toLowerCase() === n) set[x.app] = 1; });
    return Object.keys(set);
  }
  /* draft a release note from a group of detected module changes */
  function draftFromChanges(c){
    var rows = c.rows, add = rows.filter(function(x){ return x.kind === 'added'; }), upd = rows.filter(function(x){ return x.kind === 'updated'; }), rem = rows.filter(function(x){ return x.kind === 'removed'; });
    var names = function(a){ var n = a.map(function(x){ return x.name; }); return n.length > 3 ? n.slice(0, 3).join(', ') + ' +' + (n.length - 3) : n.join(', '); };
    var title = [add.length ? 'New: ' + names(add) : '', upd.length ? 'Updated: ' + names(upd) : '', !add.length && !upd.length ? 'Removed: ' + names(rem) : ''].filter(Boolean).join(' · ');
    var live = add.concat(upd), apps = {}; apps[c.app] = 1;
    live.forEach(function(x){ alsoIn(c.app, x.name).forEach(function(k){ apps[k] = 1; }); });
    var many = live.length > 1, steps = [], opened = {};
    live.forEach(function(x){
      var hub = x.hub || x.name;
      if (!opened[hub]) { opened[hub] = 1; steps.push('Open ' + appName(c.app) + ' and click “' + hub + '” in the sidebar'); }
      if (x.hub && x.hub !== x.name) steps.push((many ? '' : '') + 'Choose “' + x.name + '”');
      ((x.detail && x.detail.buttons) || []).slice(0, 4).forEach(function(b){ steps.push((many ? x.name + ': ' : '') + 'Use the “' + b + '” button'); });
    });
    var sum = [];
    if (add.length) sum.push('New in ' + appName(c.app) + ': ' + names(add) + '.');
    if (upd.length) sum.push('Updated in ' + appName(c.app) + ': ' + names(upd) + '.');
    if (rem.length) sum.push('Removed from ' + appName(c.app) + ': ' + names(rem) + '.');
    var heads = []; live.forEach(function(x){ ((x.detail && x.detail.headings) || []).slice(0, 1).forEach(function(h){ if (h && h !== x.name) heads.push(h); }); });
    return { title: title, module: live.map(function(x){ return (x.hub && x.hub !== x.name ? x.hub + ' › ' : '') + x.name; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join(', '), summary: sum.join(' '), steps: steps, apps: Object.keys(apps) };
  }
  var APPLINE = /^Available in: ([^\n]+)\n+/;
  function editR(id, pre, grp){
    var a = R.find(function(x){ return x.id === id; }) || pre || {};
    var m = APPLINE.exec(a.summary || ''), have = a.apps || (m ? m[1].split(',').map(function(x){ return x.trim(); }) : []);
    var haveN = have.map(function(x){ return appName(x).toLowerCase(); }).concat(have.map(function(x){ return String(x).toLowerCase(); }));
    var summary = (a.summary || '').replace(APPLINE, '');
    var o = modal(id ? 'Edit release note' : 'New release note',
      (pre ? '<div class="text-xs p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">Pre-filled from the detected module changes. Edit anything before saving.</div>' : '') +
      field('Title', '<input id="r_t" class="' + I + '" value="' + esc(a.title) + '" placeholder="e.g. Recurring Bills is here">') +
      field('Module', '<input id="r_m" class="' + I + '" value="' + esc(a.module) + '" placeholder="e.g. Purchase Hub > Recurring Bills">') +
      field('Can be used in', '<div class="flex flex-wrap gap-3">' + APPS.map(function(p){ return '<label class="flex items-center gap-1 text-sm"><input type="checkbox" class="r_app" value="' + p.k + '"' + (haveN.indexOf(p.k) > -1 || haveN.indexOf(p.name.toLowerCase()) > -1 ? ' checked' : '') + '> ' + esc(p.name) + '</label>'; }).join('') + '</div>') +
      field('What is it? (short summary)', '<textarea id="r_s" rows="3" class="' + I + '">' + esc(summary) + '</textarea>') +
      field('How to use it (one step per line)', '<textarea id="r_st" rows="5" class="' + I + '" placeholder="Open Purchase Hub&#10;Click Recurring Bills&#10;...">' + esc((a.steps || []).join('\n')) + '</textarea>') +
      field('Help guide link (optional)', '<input id="r_l" class="' + I + '" value="' + esc(a.link) + '" placeholder="https://">') +
      field('Video link (optional)', '<input id="r_v" class="' + I + '" value="' + esc(a.video_url) + '" placeholder="https://">') +
      audience('r_', a.company_ids) +
      '<label class="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" id="r_p"' + (a.pinned ? ' checked' : '') + '> Pin to the top</label>' +
      field('Status', '<select id="r_status" class="' + I + '"><option value="draft">Draft (not visible to users)</option><option value="published"' + (a.status === 'published' ? ' selected' : '') + '>Published (notify users now)</option></select>'),
      async function(o){
        if (!can()) { alert('Only the hub admin can publish.'); return false; }
        var t = $('#r_t', o).value.trim(); if (!t) { alert('Title is required.'); return false; }
        var st = $('#r_status', o).value;
        var apps = Array.prototype.map.call(o.querySelectorAll('.r_app:checked'), function(x){ return appName(x.value); });
        var row = { title: t, module: $('#r_m', o).value.trim(), summary: (apps.length ? 'Available in: ' + apps.join(', ') + '\n\n' : '') + $('#r_s', o).value.trim(), steps: $('#r_st', o).value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean), link: url($('#r_l', o).value), video_url: url($('#r_v', o).value), company_ids: readAud(o, 'r_'), pinned: $('#r_p', o).checked, status: st, updated_at: new Date().toISOString() };
        if (st === 'published') row.published_at = a.published_at || new Date().toISOString(); else row.published_at = null;
        var r = id ? await sb().from('acacia_announcements').update(row).eq('id', id) : await sb().from('acacia_announcements').insert(Object.assign(row, { created_by: who() }));
        if (fail(r, 'save')) return false;
        if (grp && grp.rows) { await sb().from('acacia_module_changes').update({ status: 'announced' }).in('id', grp.rows.map(function(x){ return x.id; })); }
        loadR();
      });
    bindAud(o, 'r_');
  }
  window.acxRel = {
    load: loadR, edit: function(id){ editR(id); },
    write: function(i){ var c = CH[i]; if (!c) return; editR(null, draftFromChanges(c), c); },
    scan: async function(){
      var x = await scanApps(true); if (!x || x.error || x.skipped) return;
      var msg = [];
      if (x.baseline.length) msg.push('Baseline saved for: ' + x.baseline.join(', ') + '. Future module changes there will be flagged.');
      if (x.ok.length) msg.push(x.changed ? x.changed + ' module change(s) found. See the amber box to write a release note.' : 'No module changes since the last check.');
      if (x.failed.length) msg.push('Could not read: ' + x.failed.join('; ') + '\n(The app must allow cross-site reads: Access-Control-Allow-Origin.)');
      alert(msg.join('\n\n')); loadChanges();
    },
    chDone: async function(i){ var c = CH[i]; if (!c) return; if (!can()) return alert('Only the hub admin can do this.'); var r = await sb().from('acacia_module_changes').update({ status: 'announced' }).in('id', c.rows.map(function(x){ return x.id; })); if (!fail(r, 'update')) loadChanges(); },
    toggle: async function(id){ var a = R.find(function(x){ return x.id === id; }); var pub = a.status !== 'published'; var r = await sb().from('acacia_announcements').update({ status: pub ? 'published' : 'draft', published_at: pub ? (a.published_at || new Date().toISOString()) : null }).eq('id', id); if (!fail(r, 'update')) loadR(); },
    del: async function(id){ if (!confirm('Delete this release note?')) return; var r = await sb().from('acacia_announcements').delete().eq('id', id); if (!fail(r, 'delete')) loadR(); },
    mail: function(id){ var a = R.find(function(x){ return x.id === id; }); mailTo(targets(a.company_ids), 'New in Acacia: ' + a.title, (a.module ? a.module + '\n\n' : '') + (a.summary || '') + ((a.steps || []).length ? '\n\nHow to use it:\n' + a.steps.map(function(s, i){ return (i + 1) + '. ' + s; }).join('\n') : '') + (a.link ? '\n\nGuide: ' + a.link : '') + (a.video_url ? '\nVideo: ' + a.video_url : '')); }
  };

  /* ---------- Webinars ---------- */
  function shellW(){ $('#webinars').innerHTML = '<div class="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-5 mb-6"><div><h1 class="text-3xl font-extrabold text-gray-900">Webinars &amp; Training</h1><p class="mt-2 text-sm text-gray-500">Create training from a release: pick the release when you schedule, and the form fills itself. A Meet link is created for you. Users see sessions in Books, register, and get the join link when it opens.</p></div><div class="flex gap-2 mt-4 md:mt-0"><button class="' + P + '" onclick="acxWeb.edit()">➕ Schedule webinar</button><button class="' + B + '" onclick="acxWeb.load()">🔄 Refresh</button></div></div><div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm"><table class="w-full text-left text-sm min-w-[900px]"><thead><tr class="bg-gray-50 text-xs uppercase text-gray-600"><th class="p-4">When</th><th class="p-4">Title</th><th class="p-4">Audience</th><th class="p-4">Registered</th><th class="p-4">Status</th><th class="p-4 text-right">Actions</th></tr></thead><tbody id="webBody" class="divide-y divide-gray-100"></tbody></table></div>'; }
  async function loadW(){
    if (!$('#webBody')) shellW();
    await loadCo();
    var rl = await sb().from('acacia_announcements').select('*').order('created_at', { ascending: false }); if (!rl.error) R = rl.data || [];
    var r = await sb().from('acacia_webinars').select('*').order('starts_at', { ascending: false });
    if (fail(r, 'load webinars')) return;
    W = r.data || [];
    var g = await sb().from('acacia_webinar_registrations').select('*'); REG = {};
    (g.data || []).forEach(function(x){ (REG[x.webinar_id] = REG[x.webinar_id] || []).push(x); });
    $('#webBody').innerHTML = W.length ? W.map(function(w){
      var n = (REG[w.id] || []).length, ended = w.status === 'scheduled' && new Date(w.starts_at).getTime() + w.duration_min * 60000 < Date.now();
      var c = w.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : w.status === 'completed' || ended ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800';
      return '<tr><td class="p-4 whitespace-nowrap">' + fmt(w.starts_at) + '<div class="text-xs text-gray-500">' + w.duration_min + ' min</div></td><td class="p-4 font-medium">' + esc(w.title) + '<div class="text-xs text-gray-500">' + esc(w.module || '') + '</div></td><td class="p-4">' + aud(w.company_ids) + '</td><td class="p-4"><button class="underline" onclick="acxWeb.regs(\'' + w.id + '\')">' + n + (w.capacity ? ' / ' + w.capacity : '') + '</button></td><td class="p-4">' + pill(ended ? 'ended' : w.status, c) + '</td><td class="p-4 text-right whitespace-nowrap"><button class="' + B + '" onclick="acxWeb.edit(\'' + w.id + '\')">Edit</button> <button class="' + B + '" onclick="acxWeb.mail(\'' + w.id + '\')">✉️ Invite</button> <button class="' + B + ' text-rose-600" onclick="acxWeb.del(\'' + w.id + '\')">Delete</button></td></tr>';
    }).join('') : '<tr><td colspan="6" class="p-8 text-center text-gray-500">No webinars scheduled.</td></tr>';
  }
  /* Acacia Meet link: same meeting room format as meet.html (acacia-####-topic). Anyone with the link can join. */
  function meetLink(title){
    var slug = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    var code = 'acacia-' + Math.floor(1000 + Math.random() * 9000) + (slug ? '-' + slug : '');
    return location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') + 'meet.html?room=' + encodeURIComponent(code);
  }
  function editW(id){
    var w = W.find(function(x){ return x.id === id; }) || {};
    var o = modal(id ? 'Edit webinar' : 'Schedule webinar',
      (id ? '' : field('Create training from a release', '<select id="w_rel" class="' + I + '"><option value="">— Select a release to fill this training —</option>' + R.map(function(x){ return '<option value="' + esc(x.id) + '">' + esc(x.title) + (x.module ? ' (' + esc(x.module) + ')' : '') + (x.status === 'published' ? '' : ' [draft]') + '</option>'; }).join('') + '</select>' + (R.length ? '' : '<div class="text-xs text-gray-500 mt-1">No release notes yet. Write one on the Releases page first.</div>'))) +
      field('Title', '<input id="w_t" class="' + I + '" value="' + esc(w.title) + '" placeholder="e.g. Getting started with Recurring Bills">') +
      field('Module / topic', '<input id="w_m" class="' + I + '" value="' + esc(w.module) + '">') +
      field('Description', '<textarea id="w_d" rows="3" class="' + I + '">' + esc(w.description) + '</textarea>') +
      '<div class="grid grid-cols-2 gap-3">' + '<div>' + field('Starts (your local time)', '<input id="w_s" type="datetime-local" class="' + I + '" value="' + (w.starts_at ? loc(w.starts_at) : '') + '">') + '</div><div>' + field('Duration (minutes)', '<input id="w_du" type="number" min="5" class="' + I + '" value="' + (w.duration_min || 60) + '">') + '</div></div>' +
      field('Meeting link (Zoom / Meet / Teams)', '<div class="flex gap-2"><input id="w_u" class="' + I + '" value="' + esc(w.join_url) + '" placeholder="https:// (or click Create Meet link)"><button type="button" id="w_mk" class="' + B + ' whitespace-nowrap">📹 Create Meet link</button></div>') +
      '<div class="grid grid-cols-2 gap-3"><div>' + field('Host', '<input id="w_h" class="' + I + '" value="' + esc(w.host) + '">') + '</div><div>' + field('Seats (blank = unlimited)', '<input id="w_c" type="number" min="1" class="' + I + '" value="' + (w.capacity || '') + '">') + '</div></div>' +
      audience('w_', w.company_ids) +
      field('Status', '<select id="w_st" class="' + I + '">' + ['scheduled', 'completed', 'cancelled'].map(function(s){ return '<option' + (w.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>') +
      field('Recording link (add after the session)', '<input id="w_r" class="' + I + '" value="' + esc(w.recording_url) + '" placeholder="https://">'),
      async function(o){
        if (!can()) { alert('Only the hub admin can schedule webinars.'); return false; }
        var t = $('#w_t', o).value.trim(), s = $('#w_s', o).value; if (!t || !s) { alert('Title and start time are required.'); return false; }
        var status0 = $('#w_st', o).value;
        var row = { title: t, module: $('#w_m', o).value.trim(), description: $('#w_d', o).value.trim(), starts_at: new Date(s).toISOString(), duration_min: parseInt($('#w_du', o).value, 10) || 60, join_url: url($('#w_u', o).value) || (status0 !== 'cancelled' ? meetLink($('#w_t', o).value) : ''), host: $('#w_h', o).value.trim(), capacity: parseInt($('#w_c', o).value, 10) || null, company_ids: readAud(o, 'w_'), status: $('#w_st', o).value, recording_url: url($('#w_r', o).value), updated_at: new Date().toISOString() };
        var r = id ? await sb().from('acacia_webinars').update(row).eq('id', id) : await sb().from('acacia_webinars').insert(Object.assign(row, { created_by: who() }));
        if (fail(r, 'save')) return false; loadW();
      });
    bindAud(o, 'w_');
    var pk = $('#w_rel', o);
    if (pk) pk.onchange = function(){
      var x = R.find(function(y){ return y.id === pk.value; }); if (!x) return;
      var sm = (x.summary || '').replace(/^Available in: [^\n]+\n+/, ''), st = (x.steps || []).map(function(t, i){ return (i + 1) + '. ' + t; }).join('\n');
      $('#w_t', o).value = 'Training: ' + x.title;
      $('#w_m', o).value = x.module || '';
      $('#w_d', o).value = (sm ? sm + '\n\n' : '') + (st ? 'What we will cover:\n' + st : '');
      $('#w_aud', o) && x.company_ids && x.company_ids.length && ($('#w_aud', o).value = 'some', $('#w_aud', o).onchange(), Array.prototype.forEach.call($('#w_cos', o).options, function(op){ op.selected = x.company_ids.indexOf(op.value) > -1; }));
      if (!$('#w_h', o).value) $('#w_h', o).value = who();
    };
    var mk = $('#w_mk', o);
    if (mk) mk.onclick = function(){
      var inp = $('#w_u', o);
      if (inp.value.trim() && !confirm('Replace the existing link with a new Acacia Meet link?')) return;
      inp.value = meetLink($('#w_t', o).value); inp.select();
    };
  }
  window.acxWeb = {
    load: loadW, edit: editW,
    del: async function(id){ if (!confirm('Delete this webinar and its registrations?')) return; var r = await sb().from('acacia_webinars').delete().eq('id', id); if (!fail(r, 'delete')) loadW(); },
    mail: function(id){ var w = W.find(function(x){ return x.id === id; }); mailTo(targets(w.company_ids), 'Training: ' + w.title, w.title + '\nWhen: ' + fmt(w.starts_at) + ' (' + w.duration_min + ' min)\n' + (w.host ? 'Host: ' + w.host + '\n' : '') + '\n' + (w.description || '') + '\n\nRegister inside Acacia Books > What\'s new > Training.'); },
    regs: function(id){
      var w = W.find(function(x){ return x.id === id; }), l = REG[id] || [];
      var o = modal('Registrations: ' + esc(w.title), l.length ? '<table class="w-full text-sm"><tbody>' + l.map(function(x){ return '<tr class="border-b"><td class="py-2">' + esc(x.user_name || '-') + '</td><td>' + esc(x.login_id) + '</td><td class="text-gray-500">' + esc(x.company_id || '') + '</td></tr>'; }).join('') + '</tbody></table><button class="' + B + ' mt-3" data-copy>Copy emails</button> <button class="' + B + ' mt-3" data-remind>Remind registrants</button>' : '<p class="text-gray-500">Nobody has registered yet.</p>');
      var cp = $('[data-copy]', o); if (cp) cp.onclick = function(){ navigator.clipboard.writeText(l.map(function(x){ return x.login_id; }).join(', ')); cp.textContent = 'Copied'; };
      var rm = $('[data-remind]', o); if (rm) rm.onclick = function(){
        var g = {}; l.forEach(function(x){ var c = x.company_id || ''; if (!c) return; (g[c] = g[c] || []).push(x.login_id); });
        var ids = Object.keys(g); if (!ids.length) return alert('No registrants are linked to a company.');
        if (!confirm('Save a reminder draft in Acacia Mail for ' + ids.length + ' compan' + (ids.length > 1 ? 'ies' : 'y') + ' (' + l.length + ' registrants)?')) return;
        var sub = 'Reminder: ' + w.title + ' - ' + fmt(w.starts_at);
        var body = 'This is a reminder that you are registered for the training "' + w.title + '".\n\nWhen: ' + fmt(w.starts_at) + ' (' + w.duration_min + ' min)\n' + (w.host ? 'Host: ' + w.host + '\n' : '') + (w.join_url ? 'Join link: ' + w.join_url + '\n' : 'The join link opens 15 minutes before the start in Acacia Books > What\'s new > Training.\n') + '\nSee you there.';
        ids.forEach(function(c){ var co = CO.find(function(x){ return x.company_id === c; }) || {}; window.acxMailTo({ companyId: c, company: co.company_name || c, to: g[c].join(', '), subject: sub, body: body }); });
      };
    }
  };

  var _open = window.openPage;
  window.openPage = function(id){
    var r = _open.apply(this, arguments);
    var cur = $('.page.active');
    if (cur && cur.id === 'releases') loadR();
    if (cur && cur.id === 'webinars') loadW();
    return r;
  };
})();
