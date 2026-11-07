/* =====================================================================
   My Development Studio  (studio.js)
   Add-on for the Developer Hub. Self-contained: injects its own sidebar
   item, page and styles, and uses its own tables + private storage bucket
   (see acacia_studio.sql). It does not change the Website Manager or Books.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__studioLoaded) return; window.__studioLoaded = true;

  var BUCKET = 'acacia-studio';
  var JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  var TEXT_EXT = /\.(html?|css|js|mjs|cjs|jsx|ts|tsx|json|php|txt|md|xml|svg|csv|tsv|yml|yaml|ini|env|htaccess|sql|py|rb|sh|vue|map|webmanifest|conf|log|toml|lock)$/i;
  var MIME = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', xml: 'application/xml', php: 'text/x-php', csv: 'text/csv' };
  var CATEGORIES = ['Website', 'Web app', 'Dashboard', 'E-commerce', 'Landing page', 'Portfolio', 'API / Backend', 'Other'];
  var STAGES = { development: 'In development', live: 'Live', maintenance: 'Maintenance', archived: 'Archived' };

  var sb = null;
  var S = { folders: [], projects: [], history: [], files: {}, cache: {}, loaded: false, err: null, view: 'overview', folder: null, pid: null, tab: 'files', sel: null, dirty: false, open: {}, shown: {}, curDir: '', q: '', qmode: 'name', hits: null, device: 'desktop', prevPath: null, search: '', auto: Number(localStorage.getItem('acacia_studio_auto') || 0) };

  /* ---------------- utils ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function canW() { return !!(window.__acxCanWrite && window.__acxCanWrite()); }
  function who() { try { return (JSON.parse(localStorage.getItem('developerSession') || '{}').email) || 'developer'; } catch (e) { return 'developer'; } }
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function ext(p) { var m = /\.([^.\/]+)$/.exec(p); return m ? m[1].toLowerCase() : ''; }
  function mimeOf(p) { return MIME[ext(p)] || 'application/octet-stream'; }
  function isText(p) { return TEXT_EXT.test(p); }
  function base(p) { return p.slice(p.lastIndexOf('/') + 1); }
  function fmtSize(n) { n = Number(n) || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function when(iso) { if (!iso) return 'Never'; var d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleString(); }
  function ago(iso) {
    if (!iso) return 'Never'; var s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' d ago';
  }
  function useUrl(p, htmls) { return !!p.url && (S.prevMode !== 'files' || !htmls.length); }
  function sizeInfo(p) {
    var l = S.files[p.id];
    if (l) return { n: l.reduce(function (a, r) { return a + (Number(r.size) || 0); }, 0), c: l.length };
    return (S.sizes && S.sizes[p.id]) || { n: 0, c: 0 };
  }
  function sizeCell(p) { var z = sizeInfo(p); return z.c ? '<b>' + fmtSize(z.n) + '</b><div class="st-mut">' + z.c + ' file' + (z.c === 1 ? '' : 's') + '</div>' : '<span class="st-mut">' + (p.url ? 'Live URL only' : 'Empty') + '</span>'; }
  function proj(id) { id = id || S.pid; return S.projects.find(function (p) { return p.id === id; }); }
  function toast(msg, bad) {
    var t = document.createElement('div'); t.className = 'st-toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, bad ? 5000 : 2200);
  }
  var _zip = null;
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (_zip) return _zip;
    _zip = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = JSZIP_URL; s.onload = function () { res(window.JSZip); }; s.onerror = function () { _zip = null; rej(new Error('Could not load the ZIP library. Check your internet connection.')); }; document.head.appendChild(s); });
    return _zip;
  }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }

  /* ---------------- modal + progress ---------------- */
  function closeModal() { var m = $('stModal'); if (m) m.remove(); }
  function modal(title, body, okLabel, onOk, wide) {
    closeModal();
    var d = document.createElement('div'); d.className = 'st-ov'; d.id = 'stModal';
    d.innerHTML = '<div class="st-md' + (wide ? ' wide' : '') + '"><h3>' + esc(title) + '</h3><div class="st-mb">' + body + '</div><div class="st-mf"><button class="st-b" data-x>' + (onOk ? 'Cancel' : 'Close') + '</button>' + (onOk ? '<button class="st-b pri" data-ok>' + esc(okLabel || 'Save') + '</button>' : '') + '</div></div>';
    document.body.appendChild(d);
    d.querySelector('[data-x]').onclick = closeModal;
    var ok = d.querySelector('[data-ok]');
    if (ok) ok.onclick = async function () {
      ok.disabled = true;
      try { var r = await onOk(d); if (r !== false) closeModal(); else ok.disabled = false; }
      catch (e) { ok.disabled = false; toast(e.message || String(e), true); }
    };
    var f = d.querySelector('input,select,textarea'); if (f) f.focus();
    return d;
  }
  function progress(title) {
    var d = document.createElement('div'); d.className = 'st-ov'; d.style.zIndex = 100001;
    d.innerHTML = '<div class="st-md"><h3>' + esc(title) + '</h3><div class="st-mb"><div class="st-pt">Starting…</div><div class="st-pb"><i style="width:0"></i></div></div></div>';
    document.body.appendChild(d);
    return { set: function (txt, pct) { d.querySelector('.st-pt').textContent = txt; d.querySelector('.st-pb i').style.width = Math.max(0, Math.min(100, pct || 0)) + '%'; }, done: function () { d.remove(); } };
  }

  /* ---------------- data layer ---------------- */
  async function fetchAll(q) {
    var out = [], from = 0, step = 1000;
    for (; ;) { var r = await q(from, from + step - 1); if (r.error) throw r.error; out = out.concat(r.data || []); if (!r.data || r.data.length < step) break; from += step; }
    return out;
  }
  async function loadAll() {
    var f = await sb.from('acacia_studio_folders').select('*').order('name'); if (f.error) throw f.error;
    var p = await sb.from('acacia_studio_projects').select('*').order('name'); if (p.error) throw p.error;
    var h = await sb.from('acacia_studio_history').select('*').order('created_at', { ascending: false }).limit(80); if (h.error) throw h.error;
    try { var fl = await fetchAll(function (a, b) { return sb.from('acacia_studio_files').select('project_id,size').order('id').range(a, b); }); S.sizes = {}; fl.forEach(function (r) { var x = S.sizes[r.project_id] || (S.sizes[r.project_id] = { n: 0, c: 0 }); x.n += Number(r.size) || 0; x.c++; }); } catch (e) { S.sizes = S.sizes || {}; }
    try {
      var h2 = await sb.from('acacia_studio_history').select('project_id,kind,created_at').gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(1000); S.act = h2.data || [];
      var c2 = await sb.from('acacia_studio_checks').select('project_id,ok,ms,checked_at').gte('checked_at', new Date(Date.now() - 14 * 864e5).toISOString()).limit(3000); S.chk = c2.data || [];
    } catch (e) { S.act = S.act || []; S.chk = S.chk || []; }
    S.folders = f.data || []; S.projects = p.data || []; S.history = h.data || []; S.loaded = true; S.err = null; S.loadedAt = Date.now();
  }
  async function loadFiles(pid, force) {
    if (S.files[pid] && !force) return S.files[pid];
    S.files[pid] = await fetchAll(function (a, b) { return sb.from('acacia_studio_files').select('id,project_id,path,size,mime,is_text,updated_at').eq('project_id', pid).order('path').range(a, b); });
    return S.files[pid];
  }
  function findRow(pid, p) { var l = S.files[pid] || []; return l.find(function (r) { return r.path === p; }) || l.find(function (r) { return r.path.toLowerCase() === String(p).toLowerCase(); }); }
  async function getBlob(row) {
    var c = S.cache[row.id]; if (c && c.v === row.updated_at) return c.b;
    var r = await sb.storage.from(BUCKET).download(row.project_id + '/' + row.id);
    if (r.error) throw new Error('Could not read ' + row.path + ': ' + (r.error.message || r.error));
    S.cache[row.id] = { v: row.updated_at, b: r.data }; return r.data;
  }
  async function getText(row) { return (await getBlob(row)).text(); }

  async function putMany(pid, items, prog) {
    var list = S.files[pid] || (S.files[pid] = []), byPath = {}; list.forEach(function (r) { byPath[r.path] = r; });
    var recs = [], errs = [], i = 0, done = 0;
    async function worker() {
      while (i < items.length) {
        var it = items[i++];
        try {
          var blob = it.blob || await it.get(), ex = byPath[it.path], id = ex ? ex.id : uuid();
          var up = await sb.storage.from(BUCKET).upload(pid + '/' + id, blob, { upsert: true, contentType: mimeOf(it.path) });
          if (up.error) throw up.error;
          recs.push({ id: id, project_id: pid, path: it.path, size: blob.size, mime: mimeOf(it.path), is_text: isText(it.path), updated_at: new Date().toISOString(), _b: blob });
        } catch (e) { errs.push(it.path + ': ' + (e.message || e)); }
        done++; if (prog) prog(done, items.length);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    for (var k = 0; k < recs.length; k += 200) {
      var chunk = recs.slice(k, k + 200).map(function (r) { var c = Object.assign({}, r); delete c._b; return c; });
      var r = await sb.from('acacia_studio_files').upsert(chunk, { onConflict: 'id' }); if (r.error) throw r.error;
    }
    recs.forEach(function (rec) {
      var b = rec._b; delete rec._b; var ex = byPath[rec.path];
      if (ex) Object.assign(ex, rec); else { list.push(rec); byPath[rec.path] = rec; }
      S.cache[rec.id] = { v: rec.updated_at, b: b };
    });
    list.sort(function (a, b) { return a.path < b.path ? -1 : 1; });
    return { ok: recs.length, errs: errs };
  }
  async function hist(pid, kind, note, version) {
    if (!canW()) return;
    var h0 = S.history[0];
    if (kind === 'edit' && h0 && h0.project_id === pid && h0.kind === 'edit' && h0.note === note && Date.now() - new Date(h0.created_at).getTime() < 600000) return;
    var r = await sb.from('acacia_studio_history').insert({ project_id: pid, kind: kind, note: note || null, version: version || null, created_by: who() }).select().single();
    if (r.data) S.history.unshift(r.data);
  }
  async function touch(pid, extra) {
    var upd = Object.assign({ updated_at: new Date().toISOString() }, extra || {}); var p = proj(pid); if (p) Object.assign(p, upd);
    var r = await sb.from('acacia_studio_projects').update(upd).eq('id', pid); if (r.error) throw r.error;
  }
  function needW() { if (canW()) return false; toast('Read-only: only hub admins can change the Studio.', true); return true; }

  /* ---------------- folder helpers ---------------- */
  function kids(parent) { return S.folders.filter(function (f) { return (f.parent_id || null) === (parent || null); }); }
  function fpath(id) { var out = [], f; while (id && (f = S.folders.find(function (x) { return x.id === id; }))) { out.unshift(f); id = f.parent_id; } return out; }
  function descendants(id) { var out = {}; (function w(i) { kids(i).forEach(function (k) { out[k.id] = 1; w(k.id); }); })(id); return out; }
  function folderOpts(sel, exclude) {
    var h = '<option value="">(No folder - top level)</option>';
    (function w(parent, d) { kids(parent).forEach(function (f) { if (exclude && exclude[f.id]) return; h += '<option value="' + f.id + '"' + (sel === f.id ? ' selected' : '') + '>' + '&nbsp;&nbsp;'.repeat(d) + (d ? '↳ ' : '') + esc(f.name) + '</option>'; w(f.id, d + 1); }); })(null, 0);
    return h;
  }

  /* ---------------- status ---------------- */
  function badge(p) {
    if (p.stage === 'archived') return { t: 'Archived', c: 'gray' };
    if (p.stage === 'development') return { t: 'Development', c: 'amber' };
    if (p.monitor_state === 'online') return { t: 'Online', c: 'green' };
    if (p.monitor_state === 'offline') return { t: 'Offline', c: 'red' };
    return { t: p.stage === 'maintenance' ? 'Maintenance' : (p.url ? 'Not checked' : 'Live'), c: 'blue' };
  }

  /* ---------------- import pipeline ---------------- */
  function cleanEntries(list) {
    var out = [];
    list.forEach(function (e) {
      var p = String(e.path || '').replace(/\\/g, '/').replace(/^\.?\/+/, '');
      if (!p || p.slice(-1) === '/') return;
      if (/(^|\/)(__MACOSX|\.git|node_modules)\//.test(p) || /(^|\/)(\.DS_Store|Thumbs\.db)$/.test(p) || /(^|\/)\.\.(\/|$)/.test(p)) return;
      out.push({ path: p, blob: e.blob, get: e.get });
    });
    if (out.length && out.every(function (e) { return e.path.indexOf('/') > 0; })) {
      var root = out[0].path.split('/')[0];
      if (out.every(function (e) { return e.path.split('/')[0] === root; })) out.forEach(function (e) { e.path = e.path.slice(root.length + 1); });
    }
    return out.filter(function (e) { return e.path; });
  }
  async function zipEntries(file) {
    var Z = await loadZip(), z = await Z.loadAsync(file), list = [];
    z.forEach(function (rel, entry) { if (!entry.dir) list.push({ path: rel, get: function () { return entry.async('blob'); } }); });
    return list;
  }
  function pickEntry(paths) {
    if (paths.indexOf('index.html') >= 0) return 'index.html';
    var top = paths.filter(function (p) { return /\.html?$/i.test(p) && p.indexOf('/') < 0; })[0];
    return top || paths.filter(function (p) { return /\.html?$/i.test(p); })[0] || 'index.html';
  }
  async function importInto(pid, entries, title) {
    var pg = progress(title), res;
    try { res = await putMany(pid, entries, function (d, t) { pg.set('Uploading ' + d + ' of ' + t + ' files…', d / t * 100); }); }
    finally { pg.done(); }
    return res;
  }
  async function createProject(f) {
    var rec = { id: uuid(), name: f.name, description: f.description || '', category: f.category || 'Website', stage: f.stage || 'development', folder_id: f.folder_id || null, url: f.url || null, entry_path: 'index.html', created_by: who() };
    var r = await sb.from('acacia_studio_projects').insert(rec).select().single(); if (r.error) throw r.error;
    S.projects.push(r.data); S.files[r.data.id] = []; await hist(r.data.id, 'created', 'Project created'); return r.data;
  }
  function readForm(d) {
    var g = function (n) { var e = d.querySelector('[name="' + n + '"]'); return e ? e.value.trim() : ''; };
    var url = g('url'); if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    return { name: g('name'), description: g('description'), category: g('category') || 'Website', stage: g('stage') || 'development', folder_id: g('folder_id') || null, url: url || null, version: g('version') };
  }
  function projForm(v, opts) {
    v = v || {}; opts = opts || {};
    return '<label>Name</label><input name="name" value="' + esc(v.name || '') + '" placeholder="e.g. Acacia Books">' +
      '<label>Description</label><textarea name="description" rows="2" placeholder="What is this project?">' + esc(v.description || '') + '</textarea>' +
      '<div class="st-row"><div><label>Category</label><input name="category" list="stCats" value="' + esc(v.category || 'Website') + '"><datalist id="stCats">' + CATEGORIES.map(function (c) { return '<option value="' + c + '">'; }).join('') + '</datalist></div>' +
      '<div><label>Stage</label><select name="stage">' + Object.keys(STAGES).map(function (k) { return '<option value="' + k + '"' + ((v.stage || 'development') === k ? ' selected' : '') + '>' + STAGES[k] + '</option>'; }).join('') + '</select></div></div>' +
      (opts.noFolder ? '' : '<label>Folder</label><select name="folder_id">' + folderOpts(v.folder_id || null) + '</select>') +
      '<label>Live website URL <span class="st-mut">(optional, used for monitoring)</span></label><input name="url" value="' + esc(v.url || '') + '" placeholder="https://example.com">' +
      (opts.version ? '<label>Version</label><input name="version" value="' + esc(v.version || '') + '" placeholder="1.0.0">' : '');
  }

  /* ---------------- preview builder ---------------- */
  function norm(p) { var o = []; String(p).split('/').forEach(function (s) { if (s === '' || s === '.') return; if (s === '..') o.pop(); else o.push(s); }); return o.join('/'); }
  function resolveRef(b, ref) {
    if (!ref) return null; ref = String(ref).trim();
    if (/^(https?:)?\/\/|^data:|^blob:|^mailto:|^tel:|^javascript:|^#/i.test(ref)) return null;
    ref = ref.split('#')[0].split('?')[0]; try { ref = decodeURIComponent(ref); } catch (e) { }
    if (!ref) return null; if (ref.charAt(0) === '/') return norm(ref);
    var dir = b.indexOf('/') >= 0 ? b.slice(0, b.lastIndexOf('/') + 1) : ''; return norm(dir + ref);
  }
  function toDataUrl(b) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b); }); }
  async function assetUrl(pid, p) {
    var row = findRow(pid, p); if (!row || row.size > 6e6) return null;
    var b = await getBlob(row); return toDataUrl(b.slice(0, b.size, row.mime || b.type));
  }
  async function processCss(pid, css, bs, depth) {
    var imps = Array.from(css.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;/g));
    for (var i = 0; i < imps.length; i++) {
      var p = resolveRef(bs, imps[i][1]), row = p && findRow(pid, p);
      if (row && depth < 5) css = css.replace(imps[i][0], await processCss(pid, await getText(row), row.path, depth + 1));
    }
    var urls = Array.from(new Set(Array.from(css.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g)).map(function (m) { return m[1]; })));
    for (var j = 0; j < urls.length; j++) { var q = resolveRef(bs, urls[j]); if (!q) continue; var d = await assetUrl(pid, q); if (d) css = css.split(urls[j]).join(d); }
    return css;
  }
  var BRIDGE = '(function(){var P=__P__;document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");if(!h||h.charAt(0)==="#"||/^(mailto:|tel:|javascript:|data:|blob:)/i.test(h))return;e.preventDefault();if(/^(https?:)?\\/\\//i.test(h)){window.open(h,"_blank","noopener");return;}parent.postMessage({stNav:h,from:P},"*");},true);window.addEventListener("error",function(e){parent.postMessage({stErr:(e.message||"Script error")+(e.filename?" ("+String(e.filename).split("/").pop().slice(0,40)+":"+e.lineno+")":"")},"*");});})();';
  async function buildPage(pid, path) {
    var row = findRow(pid, path); if (!row) throw new Error('File not found in this project: ' + path);
    path = row.path; var doc = new DOMParser().parseFromString(await getText(row), 'text/html'), late = [], i, el, p, r;
    var links = Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (i = 0; i < links.length; i++) {
      p = resolveRef(path, links[i].getAttribute('href')); r = p && findRow(pid, p); if (!r) continue;
      el = doc.createElement('style'); el.textContent = await processCss(pid, await getText(r), r.path, 0); if (links[i].media) el.media = links[i].media; links[i].replaceWith(el);
    }
    var scripts = Array.from(doc.querySelectorAll('script[src]'));
    for (i = 0; i < scripts.length; i++) {
      p = resolveRef(path, scripts[i].getAttribute('src')); r = p && findRow(pid, p); if (!r) continue;
      el = doc.createElement('script');
      Array.from(scripts[i].attributes).forEach(function (a) { if (['src', 'integrity', 'crossorigin'].indexOf(a.name) < 0) el.setAttribute(a.name, a.value); });
      el.textContent = (await getText(r)).replace(/<\/script/gi, '<\\/script');
      if (el.hasAttribute('defer') && el.getAttribute('type') !== 'module') { el.removeAttribute('defer'); late.push(el); scripts[i].remove(); } else scripts[i].replaceWith(el);
    }
    late.forEach(function (s) { doc.body.appendChild(s); });
    var attrs = [['img[src]', 'src'], ['source[src]', 'src'], ['video[src]', 'src'], ['audio[src]', 'src'], ['input[src]', 'src'], ['video[poster]', 'poster'], ['link[rel~="icon"][href]', 'href'], ['link[rel~="apple-touch-icon"][href]', 'href']];
    for (i = 0; i < attrs.length; i++) {
      var nodes = Array.from(doc.querySelectorAll(attrs[i][0]));
      for (var n = 0; n < nodes.length; n++) { p = resolveRef(path, nodes[n].getAttribute(attrs[i][1])); if (!p) continue; var d = await assetUrl(pid, p); if (d) nodes[n].setAttribute(attrs[i][1], d); }
    }
    var ss = Array.from(doc.querySelectorAll('[srcset]'));
    for (i = 0; i < ss.length; i++) {
      var parts = ss[i].getAttribute('srcset').split(','), outp = [];
      for (var k = 0; k < parts.length; k++) { var seg = parts[k].trim().split(/\s+/); p = resolveRef(path, seg[0]); var du = p && await assetUrl(pid, p); outp.push((du || seg[0]) + (seg[1] ? ' ' + seg[1] : '')); }
      ss[i].setAttribute('srcset', outp.join(', '));
    }
    var styles = Array.from(doc.querySelectorAll('style'));
    for (i = 0; i < styles.length; i++) styles[i].textContent = await processCss(pid, styles[i].textContent, path, 0);
    var inl = Array.from(doc.querySelectorAll('[style*="url("]'));
    for (i = 0; i < inl.length; i++) inl[i].setAttribute('style', await processCss(pid, inl[i].getAttribute('style'), path, 0));
    var bs = doc.createElement('script'); bs.textContent = BRIDGE.replace('__P__', JSON.stringify(path));
    doc.head.insertBefore(bs, doc.head.firstChild);
    return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
  }
  function navTarget(pid, from, href) {
    var p = resolveRef(from, href); if (!p) return null;
    return [p, p + '.html', p.replace(/\/?$/, '/') + 'index.html'].map(function (c) { return findRow(pid, c); }).filter(Boolean)[0] || null;
  }

  /* ---------------- monitoring ---------------- */
  async function ping(url) {
    var t = performance.now();
    if (location.protocol === 'https:' && /^http:\/\//i.test(url)) return { ok: false, ms: 0, error: 'This http:// address cannot be checked from an https dashboard. Use the https:// address.' };
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 10000);
    try { await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal }); return { ok: true, ms: Math.round(performance.now() - t) }; }
    catch (e) { return { ok: false, ms: Math.round(performance.now() - t), error: e && e.name === 'AbortError' ? 'Timed out after 10 seconds - the website did not respond.' : 'Unreachable - the server is down, the domain does not resolve, or the SSL certificate is invalid.' }; }
    finally { clearTimeout(to); }
  }
  async function checkProject(p) {
    if (!p || !p.url) return;
    var res = await ping(p.url), was = p.monitor_state, now = res.ok ? 'online' : 'offline';
    var upd = { monitor_state: now, last_checked: new Date().toISOString(), last_error: res.ok ? null : res.error, response_ms: res.ms };
    Object.assign(p, upd);
    if (canW()) {
      try {
        await sb.from('acacia_studio_projects').update(upd).eq('id', p.id);
        await sb.from('acacia_studio_checks').insert({ project_id: p.id, ok: res.ok, ms: res.ms, error: res.ok ? null : res.error });
        if (was !== now && !(was === 'unknown' && now === 'online')) await hist(p.id, 'status', res.ok ? 'Website came back online' : 'Website went offline: ' + res.error);
      } catch (e) { console.warn('[studio] could not save check', e); }
    }
  }
  async function checkAll() {
    var list = S.projects.filter(function (p) { return p.url && p.stage !== 'archived'; });
    if (!list.length) return toast('No projects have a website URL yet.', true);
    var pg = progress('Checking websites'); var i = 0;
    try { for (; i < list.length; i++) { pg.set('Checking ' + list[i].name + ' (' + (i + 1) + '/' + list.length + ')', i / list.length * 100); await checkProject(list[i]); } } finally { pg.done(); }
  }
  setInterval(async function () {
    if (!S.auto || !S.loaded || !sb || !canW() || !localStorage.getItem('developerSession')) return;
    var due = S.projects.filter(function (p) { return p.url && p.stage !== 'archived' && (!p.last_checked || Date.now() - new Date(p.last_checked).getTime() > S.auto * 60000); });
    for (var i = 0; i < due.length; i++) await checkProject(due[i]);
    if (due.length && !S.dirty && !$('stModal') && S.view === 'monitor' && !S.pid) render();
  }, 60000);

  /* ---------------- rendering ---------------- */
  function render() {
    var root = $('stRoot'); if (!root) return;
    if (S.err) { root.innerHTML = setupHtml(S.err); return; }
    if (!S.loaded) { root.innerHTML = head() + '<p class="st-mut" style="padding:20px">Loading your projects…</p>'; return; }
    if (S.pid) { renderWorkspace(); return; }
    var body = S.view === 'projects' ? viewProjects() : S.view === 'monitor' ? viewMonitor() : viewOverview();
    root.innerHTML = head() + tabsBar() + body;
  }
  function head() {
    return '<div class="st-hd"><div class="st-tt"><h1>🛠 My Development Studio</h1><span class="st-mut">Every website and app you build, in one place.</span></div><div class="st-ha"><button class="st-b" data-a="refresh">⟳ Refresh</button></div></div>' +
      (S.loaded && !canW() ? '<div class="st-warn">Read-only mode: you can browse and preview, but only hub admins can change projects.</div>' : '');
  }
  function tabsBar() {
    return '<div class="st-tabs">' + [['overview', 'Overview'], ['projects', 'Projects'], ['monitor', 'Monitoring']].map(function (t) { return '<button class="' + (S.view === t[0] ? 'on' : '') + '" data-a="view" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function setupHtml(e) {
    var msg = String(e && e.message || e), missing = /does not exist|schema cache|relation|Could not find/i.test(msg);
    return head() + '<div class="st-card" style="max-width:720px"><h3>' + (missing ? 'One-time setup needed' : 'Could not load the Studio') + '</h3>' +
      (missing ? '<p>The Studio tables are not in your Supabase project yet.</p><ol><li>Open Supabase → <b>SQL Editor</b>.</li><li>Paste the contents of <code>acacia_studio.sql</code> (included with this upgrade) and press <b>Run</b>.</li><li>Come back here and press Refresh.</li></ol>' : '<p>' + esc(msg) + '</p>') +
      '<button class="st-b pri" data-a="refresh">⟳ Try again</button></div>';
  }
  function statusPill(p) { var b = badge(p); return '<span class="st-bd ' + b.c + '">' + b.t + '</span>'; }

  function viewOverview() {
    var live = S.projects.filter(function (p) { return p.monitor_state === 'online' && p.stage !== 'archived'; }).length;
    var dev = S.projects.filter(function (p) { return p.stage === 'development'; }).length;
    var h = '<div class="st-cards"><div class="st-stat"><span>Total projects</span><b>' + S.projects.length + '</b></div><div class="st-stat"><span>Online websites</span><b class="g">' + live + '</b></div><div class="st-stat"><span>In development</span><b class="a">' + dev + '</b></div><div class="st-stat"><span>Folders</span><b>' + S.folders.length + '</b></div><div class="st-stat"><span>Total size</span><b>' + fmtSize(S.projects.reduce(function (a, p) { return a + sizeInfo(p).n; }, 0)) + '</b></div></div>';
    h += '<div class="st-card"><div class="st-ch"><h3>Project list</h3>' + (canW() ? '<button class="st-b pri" data-a="newproj">＋ New project</button>' : '') + '</div>';
    if (!S.projects.length) h += '<p class="st-mut">No projects yet. Create one, or upload a ZIP / folder from the Projects tab.</p>';
    else h += '<div class="st-scroll"><table class="st-t"><thead><tr><th>Project</th><th>Status</th><th>Size</th><th>Actions</th></tr></thead><tbody>' + S.projects.map(function (p) {
      return '<tr><td><b>' + esc(p.name) + '</b><div class="st-mut">' + esc(p.category) + (p.folder_id ? ' · ' + esc(fpath(p.folder_id).map(function (f) { return f.name; }).join(' / ')) : '') + '</div></td><td>' + statusPill(p) + '</td><td>' + sizeCell(p) + '</td><td class="st-act"><button class="st-b sm" data-a="openproj" data-id="' + p.id + '" data-tab="preview">Preview</button><button class="st-b sm" data-a="openproj" data-id="' + p.id + '" data-tab="files">Open</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '</div><div class="st-card"><h3>Recent activity</h3>' + historyList(S.history.slice(0, 12), true) + '</div>';
    return h;
  }
  function historyList(list, showProject) {
    if (!list.length) return '<p class="st-mut">Nothing recorded yet.</p>';
    return '<ul class="st-hl">' + list.map(function (h) {
      var p = showProject ? proj(h.project_id) : null;
      return '<li><span class="st-k ' + esc(h.kind) + '">' + esc(h.kind) + '</span><div><b>' + (p ? esc(p.name) + ' · ' : '') + esc(h.note || '') + '</b>' + (h.version ? ' <span class="st-mut">v' + esc(h.version) + '</span>' : '') + '<div class="st-mut">' + when(h.created_at) + (h.created_by ? ' · ' + esc(h.created_by) : '') + '</div></div></li>';
    }).join('') + '</ul>';
  }

  function viewProjects() {
    var q = S.search.toLowerCase(), cur = S.folder, h = '';
    h += '<div class="st-bar">' + (canW() ? '<button class="st-b pri" data-a="newproj">＋ New project</button><button class="st-b" data-a="newfolder">📁 New folder</button><button class="st-b" data-a="importzip">📦 Upload ZIP</button><button class="st-b" data-a="importdir">🗂 Upload folder</button><button class="st-b" data-a="importhub">⇩ Import from Website Manager</button>' : '') +
      '<input class="st-q" id="stSearch" placeholder="Search projects…" value="' + esc(S.search) + '"></div>';
    if (!q) {
      var crumbs = fpath(cur);
      h += '<div class="st-crumb"><a data-a="openfolder" data-id="">All projects</a>' + crumbs.map(function (f) { return ' / <a data-a="openfolder" data-id="' + f.id + '">' + esc(f.name) + '</a>'; }).join('') + '</div>';
      var subs = kids(cur);
      if (subs.length) h += '<div class="st-folders">' + subs.map(function (f) {
        var n = S.projects.filter(function (p) { return p.folder_id === f.id; }).length + kids(f.id).length;
        return '<div class="st-fold"><a data-a="openfolder" data-id="' + f.id + '">📁 <b>' + esc(f.name) + '</b><span class="st-mut"> ' + n + ' item' + (n === 1 ? '' : 's') + '</span></a>' + (canW() ? '<span class="st-fa"><button data-a="renamefolder" data-id="' + f.id + '" title="Rename">✏️</button><button data-a="movefolder" data-id="' + f.id + '" title="Move">➡️</button><button data-a="delfolder" data-id="' + f.id + '" title="Delete">🗑</button></span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    var list = S.projects.filter(function (p) { return q ? (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().indexOf(q) >= 0 : (p.folder_id || null) === (cur || null); });
    if (!list.length) h += '<div class="st-card"><p class="st-mut">' + (q ? 'No projects match your search.' : 'No projects here yet.') + '</p></div>';
    else h += '<div class="st-card"><div class="st-scroll"><table class="st-t"><thead><tr><th>Project</th><th>Category</th><th>Status</th><th>Size</th><th>Updated</th><th>Actions</th></tr></thead><tbody>' + list.map(function (p) {
      return '<tr><td><a class="st-lnk" data-a="openproj" data-id="' + p.id + '" data-tab="files"><b>' + esc(p.name) + '</b></a><div class="st-mut">' + esc(p.description || '') + '</div></td><td>' + esc(p.category) + '</td><td>' + statusPill(p) + '</td><td>' + sizeCell(p) + '</td><td class="st-mut">' + ago(p.updated_at) + '</td><td class="st-act"><button class="st-b sm" data-a="openproj" data-id="' + p.id + '" data-tab="files">Open</button><button class="st-b sm" data-a="openproj" data-id="' + p.id + '" data-tab="preview">Preview</button>' +
        (canW() ? '<button class="st-b sm" data-a="editproj" data-id="' + p.id + '">Edit</button><button class="st-b sm" data-a="moveproj" data-id="' + p.id + '">Move</button><button class="st-b sm dng" data-a="delproj" data-id="' + p.id + '">Delete</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }

  function viewMonitor() {
    var list = S.projects.filter(function (p) { return p.stage !== 'archived'; });
    var h = '<div class="st-bar"><button class="st-b pri" data-a="checkall">⟳ Check all now</button><label class="st-inl">Auto-check every <select id="stAuto"><option value="0"' + (!S.auto ? ' selected' : '') + '>Off</option>' + [5, 15, 30, 60].map(function (m) { return '<option value="' + m + '"' + (S.auto === m ? ' selected' : '') + '>' + m + ' min</option>'; }).join('') + '</select></label></div>';
    h += '<div class="st-note">Checks run from your browser, so they happen while this dashboard is open. A site shows <b>Offline</b> when it cannot be reached at all (down, DNS or SSL problem, timeout). A browser cannot read the HTTP status code of another website.</div>';
    h += '<div class="st-card"><div class="st-scroll"><table class="st-t"><thead><tr><th>Project</th><th>Status</th><th>Last checked</th><th>Response</th><th>Error</th><th></th></tr></thead><tbody>' + (list.map(function (p) {
      return '<tr><td><a class="st-lnk" data-a="openproj" data-id="' + p.id + '" data-tab="monitor"><b>' + esc(p.name) + '</b></a><div class="st-mut">' + (p.url ? esc(p.url) : 'No URL set') + '</div></td><td>' + (p.url ? statusPill(p) : '<span class="st-bd gray">No URL</span>') + '</td><td>' + (p.last_checked ? ago(p.last_checked) : 'Never') + '</td><td>' + (p.response_ms != null && p.monitor_state === 'online' ? p.response_ms + ' ms' : '-') + '</td><td class="st-err">' + esc(p.monitor_state === 'offline' ? p.last_error || '' : '') + '</td><td>' + (p.url ? '<button class="st-b sm" data-a="check" data-id="' + p.id + '">Check now</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="st-mut">No projects yet.</td></tr>') + '</tbody></table></div></div>';
    return h;
  }

  /* ---- workspace ---- */
  async function openProject(id, tab) {
    if (S.dirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    S.dirty = false; S.pid = id; S.tab = tab || 'files'; S.sel = null; S.hits = null; S.q = ''; S.curDir = ''; S.prevPath = null; S.prevMode = null;
    var root = $('stRoot'); root.innerHTML = head() + '<p class="st-mut" style="padding:20px">Opening project…</p>';
    try { await loadFiles(id); } catch (e) { toast(e.message || String(e), true); }
    renderWorkspace();
  }
  function renderWorkspace() {
    var p = proj(); if (!p) { S.pid = null; return render(); }
    var tabs = [['files', 'Files'], ['preview', 'Preview'], ['monitor', 'Monitor & history'], ['details', 'Details']];
    var h = '<div class="st-hd"><div class="st-tt"><button class="st-b" data-a="back">← Projects</button><h1>' + esc(p.name) + '</h1>' + statusPill(p) + '</div><div class="st-ha">' + (p.url ? '<button class="st-b" data-a="visit">Visit site ↗</button>' : '') + '</div></div>' +
      (!canW() ? '<div class="st-warn">Read-only mode: only hub admins can change projects.</div>' : '') +
      '<div class="st-tabs">' + tabs.map(function (t) { return '<button class="' + (S.tab === t[0] ? 'on' : '') + '" data-a="wtab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    var root = $('stRoot');
    if (S.tab === 'files') {
      var up = canW() ? '<button class="st-b sm" data-a="newfile">＋ File</button><button class="st-b sm" data-a="upload">⇪ Upload</button>' : '';
      root.innerHTML = h + '<div class="st-ex"><div class="st-side"><div class="st-sbar">' + up + '<button class="st-b sm" data-a="dlproj">⬇ ZIP</button></div><div class="st-sbar"><input class="st-q" id="stFq" placeholder="Search…" value="' + esc(S.q) + '"><select id="stFm"><option value="name"' + (S.qmode === 'name' ? ' selected' : '') + '>File names</option><option value="code"' + (S.qmode === 'code' ? ' selected' : '') + '>Inside code</option></select></div><div class="st-mut st-tgt">Upload target: /' + esc(S.curDir) + '</div><div id="stTree" class="st-tree"></div></div><div id="stEditor" class="st-edit"></div></div>';
      renderTree(); renderEditor();
    } else if (S.tab === 'preview') {
      var htmls = (S.files[p.id] || []).filter(function (r) { return /\.html?$/i.test(r.path); });
      var cur = S.prevPath || (findRow(p.id, p.entry_path) ? p.entry_path : pickEntry((S.files[p.id] || []).map(function (r) { return r.path; })));
      root.innerHTML = h + '<div class="st-bar">' + [['desktop', '🖥 Desktop'], ['tablet', '▭ Tablet'], ['mobile', '📱 Mobile']].map(function (d) { return '<button class="st-b sm' + (S.device === d[0] ? ' pri' : '') + '" data-a="device" data-d="' + d[0] + '">' + d[1] + '</button>'; }).join('') +
        (p.url && htmls.length ? '<select id="stSrc"><option value="url"' + (useUrl(p, htmls) ? ' selected' : '') + '>Live site (' + esc(p.url.replace(/^https?:\/\//, '')) + ')</option><option value="files"' + (useUrl(p, htmls) ? '' : ' selected') + '>Uploaded files</option></select>' : '') + (htmls.length && !useUrl(p, htmls) ? '<select id="stPage">' + htmls.map(function (r) { return '<option value="' + esc(r.path) + '"' + (r.path === cur ? ' selected' : '') + '>' + esc(r.path) + '</option>'; }).join('') + '</select>' : '') +
        '<button class="st-b sm" data-a="prevrefresh">⟳ Refresh</button><button class="st-b sm" data-a="newtab">↗ Open in new tab</button></div>' +
        '<div id="stPrevErr" class="st-err hidden"></div><div class="st-fw ' + S.device + '"><iframe id="stFrame" sandbox="allow-scripts allow-forms allow-popups allow-modals" title="Website preview"></iframe></div>' +
        '<p class="st-mut" style="margin-top:8px">' + (useUrl(p, htmls) ? 'Showing your live site. If it stays blank, the site does not allow being shown inside another page - use “Visit site” instead.' : 'The preview runs in an isolated sandbox: it cannot see your dashboard, your login or any other project.') + '</p>';
      loadPreview(useUrl(p, htmls) ? null : (htmls.length ? cur : null));
    } else if (S.tab === 'monitor') {
      root.innerHTML = h + '<div id="stMon"><p class="st-mut">Loading…</p></div>'; renderMonitorTab();
    } else {
      root.innerHTML = h + '<div class="st-card" style="max-width:640px"><h3>Project details</h3><div id="stDet">' + projForm(p, { version: true }) +
        '<label>Start page <span class="st-mut">(opened by Preview)</span></label><select name="entry">' + ((S.files[p.id] || []).filter(function (r) { return /\.html?$/i.test(r.path); }).map(function (r) { return '<option' + (r.path === p.entry_path ? ' selected' : '') + '>' + esc(r.path) + '</option>'; }).join('') || '<option>' + esc(p.entry_path) + '</option>') + '</select></div>' +
        (canW() ? '<div class="st-mf" style="justify-content:space-between"><button class="st-b dng" data-a="delproj" data-id="' + p.id + '">Delete project</button><button class="st-b pri" data-a="savedet">Save changes</button></div>' : '') + '</div>';
    }
  }

  /* ---- file tree ---- */
  function buildTree(rows) {
    var root = { d: {}, f: [], p: '' };
    rows.forEach(function (r) { var parts = r.path.split('/'), n = root; for (var i = 0; i < parts.length - 1; i++) n = n.d[parts[i]] || (n.d[parts[i]] = { d: {}, f: [], p: parts.slice(0, i + 1).join('/') }); n.f.push(r); });
    return root;
  }
  function treeHtml(n, depth, total) {
    var h = '', pad = 8 + depth * 14;
    Object.keys(n.d).sort().forEach(function (k) {
      var c = n.d[k], o = S.open[c.p] !== undefined ? S.open[c.p] : (total < 120 || depth < 1); S.shown[c.p] = o;
      h += '<div class="st-ti dir' + (S.curDir === c.p ? ' cur' : '') + '" style="padding-left:' + pad + 'px" data-a="tdir" data-p="' + esc(c.p) + '"><span>' + (o ? '▾' : '▸') + ' 📁 ' + esc(k) + '</span>' + (canW() ? '<em><button data-a="frename" data-p="' + esc(c.p) + '" data-dir="1" title="Rename / move">✏️</button><button data-a="fdel" data-p="' + esc(c.p) + '" data-dir="1" title="Delete folder">🗑</button></em>' : '') + '</div>';
      if (o) h += treeHtml(c, depth + 1, total);
    });
    n.f.slice().sort(function (a, b) { return a.path < b.path ? -1 : 1; }).forEach(function (r) {
      h += '<div class="st-ti file' + (S.sel === r.path ? ' on' : '') + '" style="padding-left:' + (pad + 14) + 'px" data-a="tfile" data-p="' + esc(r.path) + '"><span>' + (/\.html?$/i.test(r.path) ? '🌐' : /\.css$/i.test(r.path) ? '🎨' : /\.m?js$|\.json$/i.test(r.path) ? '📜' : r.is_text ? '📄' : '🖼') + ' ' + esc(base(r.path)) + '</span>' + (canW() ? '<em><button data-a="frename" data-p="' + esc(r.path) + '" title="Rename / move">✏️</button><button data-a="fdel" data-p="' + esc(r.path) + '" title="Delete">🗑</button></em>' : '') + '</div>';
    });
    return h;
  }
  function renderTree() {
    var el = $('stTree'); if (!el) return; var p = proj(), rows = S.files[p.id] || [];
    if (S.hits) { el.innerHTML = '<div class="st-mut" style="padding:6px 8px">' + (S.hits.busy ? esc(S.hits.busy) : S.hits.list.length + ' match' + (S.hits.list.length === 1 ? '' : 'es') + ' for “' + esc(S.hits.q) + '”') + ' <a class="st-lnk" data-a="clearsearch">clear</a></div>' + S.hits.list.map(function (m) { return '<div class="st-ti hit" data-a="hit" data-p="' + esc(m.path) + '" data-l="' + m.line + '"><b>' + esc(m.path) + '</b>:' + m.line + '<div class="st-mut">' + esc(m.text) + '</div></div>'; }).join(''); return; }
    if (S.q && S.qmode === 'name') {
      var q = S.q.toLowerCase(), f = rows.filter(function (r) { return r.path.toLowerCase().indexOf(q) >= 0; });
      el.innerHTML = f.length ? f.map(function (r) { return '<div class="st-ti file' + (S.sel === r.path ? ' on' : '') + '" data-a="tfile" data-p="' + esc(r.path) + '"><span>' + esc(r.path) + '</span></div>'; }).join('') : '<p class="st-mut" style="padding:8px">No files match.</p>'; return;
    }
    el.innerHTML = rows.length ? '<div class="st-ti dir' + (S.curDir === '' ? ' cur' : '') + '" data-a="tdir" data-p="" style="padding-left:8px"><span>📂 / (project root)</span></div>' + treeHtml(buildTree(rows), 0, rows.length) : '<p class="st-mut" style="padding:8px">No files yet. Use Upload to add files or a ZIP.</p>';
  }
  var edTok = 0;
  async function renderEditor(line) {
    var el = $('stEditor'); if (!el) return; var p = proj();
    if (!S.sel) { el.innerHTML = '<div class="st-empty">Select a file to view or edit it.<div class="st-mut">' + (S.files[p.id] || []).length + ' files · ' + fmtSize((S.files[p.id] || []).reduce(function (a, r) { return a + (r.size || 0); }, 0)) + '</div></div>'; return; }
    var row = findRow(p.id, S.sel); if (!row) { S.sel = null; return renderEditor(); }
    var tok = ++edTok, headH = '<div class="st-edh"><b>' + esc(row.path) + '</b> <span class="st-mut">' + fmtSize(row.size) + '</span><span id="stDirty" class="st-dirty hidden">● unsaved</span><span class="st-ha">' + (row.is_text && canW() ? '<button class="st-b sm pri" data-a="save">Save</button>' : '') + '<button class="st-b sm" data-a="dl">⬇ Download</button></span></div>';
    if (row.is_text && row.size <= 2 * 1048576) {
      el.innerHTML = headH + '<div class="st-mut" style="padding:14px">Loading…</div>';
      var txt; try { txt = await getText(row); } catch (e) { if (tok === edTok) el.innerHTML = headH + '<div class="st-err" style="padding:14px">' + esc(e.message) + '</div>'; return; }
      if (tok !== edTok) return;
      el.innerHTML = headH + '<textarea id="stEd" spellcheck="false" wrap="off"' + (canW() ? '' : ' readonly') + '></textarea><div class="st-foot"><span id="stLc"></span><span class="st-mut">Ctrl+S to save · Tab inserts 2 spaces</span></div>';
      var ta = $('stEd'); ta.value = txt; lc();
      if (line) { var off = 0, ls = txt.split('\n'); for (var i = 0; i < line - 1 && i < ls.length; i++) off += ls[i].length + 1; ta.focus(); ta.setSelectionRange(off, off + (ls[line - 1] || '').length); ta.scrollTop = Math.max(0, (line - 4) * 18); }
    } else if (/^image\//.test(row.mime || '')) {
      el.innerHTML = headH + '<div class="st-img"><span class="st-mut">Loading…</span></div>';
      try { var b = await getBlob(row); if (tok !== edTok) return; var u = URL.createObjectURL(b.slice(0, b.size, row.mime)); el.querySelector('.st-img').innerHTML = '<img src="' + u + '" alt="">'; } catch (e) { el.querySelector('.st-img').textContent = e.message; }
    } else el.innerHTML = headH + '<div class="st-empty">This file can’t be edited in the browser.<div class="st-mut">Use Download to get it.</div></div>';
    function lc() { var t = $('stEd'); if (!t) return; var s = $('stLc'); if (s) s.textContent = t.value.split('\n').length + ' lines'; }
  }
  function markDirty(v) { S.dirty = v; var d = $('stDirty'); if (d) d.classList.toggle('hidden', !v); }

  async function selectFile(path, line) {
    if (S.dirty && !confirm('You have unsaved changes in this file. Discard them?')) return;
    S.sel = path; markDirty(false); renderTree(); await renderEditor(line);
  }
  async function saveFile() {
    if (needW()) return; var p = proj(), ta = $('stEd'), row = S.sel && findRow(p.id, S.sel); if (!ta || !row) return;
    var r = await putMany(p.id, [{ path: row.path, blob: new Blob([ta.value], { type: row.mime || 'text/plain' }) }]);
    if (r.errs.length) return toast('Save failed: ' + r.errs[0], true);
    markDirty(false); await touch(p.id); await hist(p.id, 'edit', row.path); toast('Saved ' + base(row.path));
  }
  async function searchCode(q) {
    var p = proj(), rows = (S.files[p.id] || []).filter(function (r) { return r.is_text && r.size < 1.5 * 1048576; }).slice(0, 2000), list = [], low = q.toLowerCase(), i = 0, done = 0;
    S.hits = { q: q, list: list, busy: 'Searching 0 / ' + rows.length + '…' }; renderTree();
    async function w() { while (i < rows.length && list.length < 300) { var r = rows[i++]; try { var ls = (await getText(r)).split('\n'), c = 0; for (var k = 0; k < ls.length && c < 5; k++) if (ls[k].toLowerCase().indexOf(low) >= 0) { list.push({ path: r.path, line: k + 1, text: ls[k].trim().slice(0, 140) }); c++; } } catch (e) { } done++; if (done % 8 === 0 && S.hits) { S.hits.busy = 'Searching ' + done + ' / ' + rows.length + '…'; renderTree(); } } }
    await Promise.all([w(), w(), w(), w(), w(), w()]);
    if (S.hits && S.hits.q === q) { S.hits.busy = null; renderTree(); }
  }

  /* ---- file operations ---- */
  async function newFile() {
    if (needW()) return; var p = proj(), def = (S.curDir ? S.curDir + '/' : '') + 'new-file.html', path = prompt('New file path (folders are created automatically):', def);
    if (!path) return; path = norm(path.replace(/\\/g, '/')); if (!path) return;
    if (findRow(p.id, path)) return toast('A file with that path already exists.', true);
    var r = await putMany(p.id, [{ path: path, blob: new Blob([''], { type: mimeOf(path) }) }]); if (r.errs.length) return toast(r.errs[0], true);
    await touch(p.id); await hist(p.id, 'edit', 'Created ' + path); S.sel = path; renderTree(); renderEditor();
  }
  async function renamePath(path, isDir) {
    if (needW()) return; var p = proj(), np = prompt((isDir ? 'New folder path' : 'New file path') + ' (change the name or move it by editing the path):', path); if (!np) return;
    np = norm(np.replace(/\\/g, '/')); if (!np || np === path) return;
    var rows = S.files[p.id], targets = isDir ? rows.filter(function (r) { return r.path.indexOf(path + '/') === 0; }) : rows.filter(function (r) { return r.path === path; });
    if (!targets.length) return;
    var clash = targets.some(function (r) { var n = np + r.path.slice(path.length); return rows.some(function (o) { return o.path === n && targets.indexOf(o) < 0; }); });
    if (clash) return toast('Something already exists at that path.', true);
    var i = 0; async function w() { while (i < targets.length) { var r = targets[i++], n = isDir ? np + r.path.slice(path.length) : np; var u = await sb.from('acacia_studio_files').update({ path: n, mime: mimeOf(n), is_text: isText(n) }).eq('id', r.id); if (u.error) throw u.error; r.path = n; r.mime = mimeOf(n); r.is_text = isText(n); } }
    try { await Promise.all([w(), w(), w(), w()]); } catch (e) { return toast(e.message || String(e), true); }
    rows.sort(function (a, b) { return a.path < b.path ? -1 : 1; });
    if (S.sel && (S.sel === path || S.sel.indexOf(path + '/') === 0)) S.sel = isDir ? np + S.sel.slice(path.length) : np;
    await touch(p.id); await hist(p.id, 'rename', path + ' → ' + np); renderTree(); renderEditor();
  }
  async function deletePath(path, isDir) {
    if (needW()) return; var p = proj(), rows = S.files[p.id], targets = isDir ? rows.filter(function (r) { return r.path.indexOf(path + '/') === 0; }) : rows.filter(function (r) { return r.path === path; });
    if (!targets.length) return;
    if (!confirm(isDir ? 'Delete the folder "' + path + '" and its ' + targets.length + ' file(s)? This cannot be undone.' : 'Delete "' + path + '"? This cannot be undone.')) return;
    try {
      for (var k = 0; k < targets.length; k += 100) { var ch = targets.slice(k, k + 100), rm = await sb.storage.from(BUCKET).remove(ch.map(function (r) { return p.id + '/' + r.id; })); if (rm.error) throw rm.error; var d = await sb.from('acacia_studio_files').delete().in('id', ch.map(function (r) { return r.id; })); if (d.error) throw d.error; }
    } catch (e) { return toast(e.message || String(e), true); }
    S.files[p.id] = rows.filter(function (r) { return targets.indexOf(r) < 0; }); targets.forEach(function (r) { delete S.cache[r.id]; });
    if (S.sel && targets.some(function (r) { return r.path === S.sel; })) { S.sel = null; markDirty(false); }
    await touch(p.id); await hist(p.id, 'delete', path + (isDir ? '/ (' + targets.length + ' files)' : '')); renderTree(); renderEditor();
  }
  async function downloadFile() { var p = proj(), row = S.sel && findRow(p.id, S.sel); if (!row) return; try { download(await getBlob(row), base(row.path)); } catch (e) { toast(e.message, true); } }
  async function downloadProject() {
    var p = proj(), rows = S.files[p.id] || []; if (!rows.length) return toast('This project has no files.', true);
    var Z = await loadZip(), z = new Z(), pg = progress('Preparing ZIP'), i = 0, done = 0;
    try {
      async function w() { while (i < rows.length) { var r = rows[i++]; z.file(r.path, await getBlob(r)); pg.set('Reading ' + (++done) + ' of ' + rows.length + '…', done / rows.length * 80); } }
      await Promise.all([w(), w(), w(), w()]); pg.set('Building ZIP…', 90);
      download(await z.generateAsync({ type: 'blob' }), p.name.replace(/[^\w.-]+/g, '_') + '.zip');
    } catch (e) { toast(e.message || String(e), true); } finally { pg.done(); }
  }
  async function uploadFiles(files) {
    if (needW() || !files.length) return; var p = proj(), items = [], prefix = S.curDir ? S.curDir + '/' : '';
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (/\.zip$/i.test(f.name) && confirm('Extract "' + f.name + '" into this project' + (prefix ? ' (inside /' + S.curDir + ')' : '') + '? Files with the same path in THIS project are replaced; other projects are never touched.')) {
        try { cleanEntries(await zipEntries(f)).forEach(function (e) { items.push({ path: prefix + e.path, get: e.get }); }); } catch (e) { return toast('Could not read ZIP: ' + e.message, true); }
      } else items.push({ path: prefix + f.name, blob: f });
    }
    if (!items.length) return;
    var r = await importInto(p.id, items, 'Uploading to ' + p.name);
    await touch(p.id); await hist(p.id, 'upload', r.ok + ' file(s) uploaded' + (r.errs.length ? ', ' + r.errs.length + ' failed' : ''));
    if (r.errs.length) toast(r.errs[0], true); else toast(r.ok + ' file(s) uploaded');
    renderTree(); renderEditor();
  }

  /* ---- preview ---- */
  async function loadPreview(path) {
    var fr = $('stFrame'); if (!fr) return; var p = proj(), er = $('stPrevErr'); if (er) { er.classList.add('hidden'); er.textContent = ''; }
    if (!path) {
      if (p.url) {
        var same = true; try { same = new URL(p.url, location.href).origin === location.origin; } catch (e) { }
        /* a live site on its own domain (e.g. Vercel) may keep its cookies/storage; same-origin URLs stay fully sandboxed */
        fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals' + (same ? '' : ' allow-same-origin'));
        fr.removeAttribute('srcdoc'); fr.src = p.url; return;
      }
      fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
      fr.srcdoc = '<body style="font-family:sans-serif;padding:40px;color:#555"><h3>Nothing to preview yet</h3><p>Upload files (with an index.html) or set a website URL in Details.</p></body>'; return;
    }
    S.prevPath = path; fr.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals'); fr.removeAttribute('src'); fr.srcdoc = '<body style="font-family:sans-serif;padding:40px;color:#888">Building preview…</body>';
    try { fr.srcdoc = await buildPage(p.id, path); } catch (e) { fr.srcdoc = '<body style="font-family:sans-serif;padding:40px;color:#b91c1c"><h3>Preview failed</h3><p>' + esc(e.message) + '</p></body>'; }
    var sel = $('stPage'); if (sel) sel.value = S.prevPath;
  }
  window.addEventListener('message', function (e) {
    var fr = $('stFrame'); if (!fr || e.source !== fr.contentWindow) return; var d = e.data || {}, p = proj();
    if (d.stNav && p) { var row = navTarget(p.id, d.from, d.stNav); if (row) loadPreview(row.path); else { var er = $('stPrevErr'); if (er) { er.textContent = 'Link target not found in this project: ' + d.stNav; er.classList.remove('hidden'); } } }
    if (d.stErr) { var er2 = $('stPrevErr'); if (er2) { er2.textContent = 'Script error in page: ' + String(d.stErr).slice(0, 300); er2.classList.remove('hidden'); } }
  });
  async function openNewTab() {
    var p = proj(), rows = S.files[p.id] || [], htmls = rows.filter(function (r) { return /\.html?$/i.test(r.path); });
    if (useUrl(p, htmls)) { window.open(p.url, '_blank', 'noopener'); return; }
    if (!htmls.length) { toast('Nothing to open yet.', true); return; }
    var w = window.open('about:blank', '_blank'); if (!w) return toast('Your browser blocked the new tab. Allow pop-ups for this page.', true);
    w.document.write('<body style="font-family:sans-serif;padding:40px;color:#888">Building website…</body>');
    try {
      var entry = S.prevPath || p.entry_path, pages = {}, list = htmls.slice(0, 40);
      if (!findRow(p.id, entry)) entry = htmls[0].path;
      for (var i = 0; i < list.length; i++) pages[list[i].path] = await buildPage(p.id, list[i].path);
      if (!pages[entry]) pages[entry] = await buildPage(p.id, entry);
      var wrap = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(p.name) + '</title><style>html,body{margin:0;height:100%;background:#fff}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe id="f" sandbox="allow-scripts allow-forms allow-popups allow-modals"></iframe><script>var norm=' + norm.toString() + ';var resolveRef=' + resolveRef.toString() + ';var PAGES=' + JSON.stringify(pages).replace(/</g, '\\u003c') + ';var f=document.getElementById("f");function go(x){f.srcdoc=PAGES[x];}go(' + JSON.stringify(entry) + ');window.addEventListener("message",function(e){if(e.source!==f.contentWindow)return;var d=e.data||{};if(!d.stNav)return;var p=resolveRef(d.from,d.stNav);if(!p)return;var c=[p,p+".html",p.replace(/\\/?$/,"/")+"index.html"];for(var i=0;i<c.length;i++)if(PAGES[c[i]]){go(c[i]);return;}});<\/script></body></html>';
      w.location.href = URL.createObjectURL(new Blob([wrap], { type: 'text/html' }));
    } catch (e) { w.close(); toast(e.message || String(e), true); }
  }

  /* ---- monitor tab ---- */
  async function renderMonitorTab() {
    var p = proj(), el = $('stMon'); if (!el) return;
    var ck = await sb.from('acacia_studio_checks').select('*').eq('project_id', p.id).order('checked_at', { ascending: false }).limit(15);
    var hs = await sb.from('acacia_studio_history').select('*').eq('project_id', p.id).order('created_at', { ascending: false }).limit(60);
    if (!$('stMon')) return;
    var b = badge(p);
    $('stMon').innerHTML = '<div class="st-cols"><div class="st-card"><div class="st-ch"><h3>Website status</h3>' + (p.url ? '<button class="st-b sm pri" data-a="check" data-id="' + p.id + '">Check now</button>' : '') + '</div>' +
      (p.url ? '<p><span class="st-bd ' + b.c + '">' + b.t + '</span> <a class="st-lnk" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.url) + '</a></p><p class="st-mut">Last checked: ' + (p.last_checked ? when(p.last_checked) : 'never') + (p.response_ms != null && p.monitor_state === 'online' ? ' · ' + p.response_ms + ' ms' : '') + '</p>' + (p.monitor_state === 'offline' ? '<div class="st-err">⚠ ' + esc(p.last_error || 'Unreachable') + '</div>' : '') : '<p class="st-mut">No website URL set. Add one in Details to monitor this project.</p>') +
      '<h4>Recent checks</h4>' + (ck.data && ck.data.length ? '<ul class="st-hl">' + ck.data.map(function (c) { return '<li><span class="st-k ' + (c.ok ? 'deploy' : 'delete') + '">' + (c.ok ? 'up' : 'down') + '</span><div>' + when(c.checked_at) + (c.ok ? ' · ' + c.ms + ' ms' : '<div class="st-err">' + esc(c.error || '') + '</div>') + '</div></li>'; }).join('') + '</ul>' : '<p class="st-mut">No checks recorded yet.</p>') + '</div>' +
      '<div class="st-card"><div class="st-ch"><h3>Deployment &amp; update history</h3>' + (canW() ? '<button class="st-b sm pri" data-a="logdeploy">Log deployment</button>' : '') + '</div>' + (p.last_deployed_at ? '<p class="st-mut">Last deployed ' + when(p.last_deployed_at) + (p.version ? ' · v' + esc(p.version) : '') + '</p>' : '') + historyList(hs.data || [], false) + '</div></div>';
  }

  /* ---------------- actions ---------------- */
  async function refresh(keep) {
    try { await loadAll(); if (S.pid) { await loadFiles(S.pid, true); } } catch (e) { S.err = e; }
    if (keep && S.pid && S.dirty) return; render();
  }
  async function act(a, d, el) {
    switch (a) {
      case 'refresh': S.err = null; S.loaded = false; render(); return refresh();
      case 'view': S.view = d.v; return render();
      case 'back': if (S.dirty && !confirm('You have unsaved changes. Leave without saving?')) return; S.dirty = false; S.pid = null; S.view = 'projects'; return render();
      case 'openproj': return openProject(d.id, d.tab);
      case 'wtab': if (S.dirty && !confirm('You have unsaved changes. Leave without saving?')) return; markDirty(false); S.tab = d.t; return renderWorkspace();
      case 'visit': var pv = proj(); if (pv && pv.url) window.open(pv.url, '_blank', 'noopener'); return;
      case 'openfolder': S.folder = d.id || null; S.search = ''; return render();
      case 'newfolder': return newFolder();
      case 'renamefolder': return renameFolder(d.id);
      case 'movefolder': return moveFolder(d.id);
      case 'delfolder': return delFolder(d.id);
      case 'newproj': return newProject();
      case 'editproj': return editProject(d.id);
      case 'moveproj': return moveProject(d.id);
      case 'delproj': return delProject(d.id);
      case 'importzip': return $('stZip').click();
      case 'importdir': return $('stDir').click();
      case 'importhub': return importFromHub();
      case 'check': var pr = proj(d.id); if (!pr) return; el.disabled = true; el.textContent = 'Checking…'; await checkProject(pr); if (S.pid) renderWorkspace(); else render(); return;
      case 'checkall': await checkAll(); return render();
      case 'tdir': S.curDir = d.p; S.open[d.p] = !S.shown[d.p]; var tg = document.querySelector('.st-tgt'); if (tg) tg.textContent = 'Upload target: /' + S.curDir; return renderTree();
      case 'tfile': return selectFile(d.p);
      case 'hit': return selectFile(d.p, Number(d.l));
      case 'clearsearch': S.hits = null; S.q = ''; var fq = $('stFq'); if (fq) fq.value = ''; return renderTree();
      case 'save': return saveFile();
      case 'dl': return downloadFile();
      case 'dlproj': return downloadProject();
      case 'newfile': return newFile();
      case 'upload': return $('stUp').click();
      case 'frename': return renamePath(d.p, !!d.dir);
      case 'fdel': return deletePath(d.p, !!d.dir);
      case 'device': S.device = d.d; return renderWorkspace();
      case 'prevrefresh': try { await loadFiles(S.pid, true); } catch (e) { } return loadPreview(($('stPage') && $('stPage').value) || S.prevPath);
      case 'newtab': return openNewTab();
      case 'logdeploy': return logDeploy();
      case 'savedet': return saveDetails();
    }
  }
  async function newFolder() {
    if (needW()) return; var n = prompt('Folder name:'); if (!n || !n.trim()) return;
    var r = await sb.from('acacia_studio_folders').insert({ name: n.trim(), parent_id: S.folder || null, created_by: who() }).select().single();
    if (r.error) return toast(r.error.message, true); S.folders.push(r.data); render();
  }
  async function renameFolder(id) {
    if (needW()) return; var f = S.folders.find(function (x) { return x.id === id; }), n = prompt('Rename folder:', f.name); if (!n || !n.trim()) return;
    var r = await sb.from('acacia_studio_folders').update({ name: n.trim() }).eq('id', id); if (r.error) return toast(r.error.message, true); f.name = n.trim(); render();
  }
  function moveFolder(id) {
    if (needW()) return; var f = S.folders.find(function (x) { return x.id === id; }), ex = descendants(id); ex[id] = 1;
    modal('Move folder “' + f.name + '”', '<label>New parent folder</label><select name="to">' + folderOpts(f.parent_id, ex) + '</select>', 'Move', async function (d) {
      var to = d.querySelector('[name="to"]').value || null, r = await sb.from('acacia_studio_folders').update({ parent_id: to }).eq('id', id); if (r.error) throw r.error; f.parent_id = to; render();
    });
  }
  async function delFolder(id) {
    if (needW()) return; var f = S.folders.find(function (x) { return x.id === id; });
    if (!confirm('Delete the folder "' + f.name + '"? Everything inside it (projects and subfolders) moves up one level - no project is deleted.')) return;
    var up = f.parent_id || null;
    var a = await sb.from('acacia_studio_projects').update({ folder_id: up }).eq('folder_id', id); if (a.error) return toast(a.error.message, true);
    var b = await sb.from('acacia_studio_folders').update({ parent_id: up }).eq('parent_id', id); if (b.error) return toast(b.error.message, true);
    var c = await sb.from('acacia_studio_folders').delete().eq('id', id); if (c.error) return toast(c.error.message, true);
    S.projects.forEach(function (p) { if (p.folder_id === id) p.folder_id = up; }); S.folders.forEach(function (x) { if (x.parent_id === id) x.parent_id = up; });
    S.folders = S.folders.filter(function (x) { return x.id !== id; }); if (S.folder === id) S.folder = up; render();
  }
  function newProject() {
    if (needW()) return;
    modal('New project', projForm({ folder_id: S.folder }), 'Create project', async function (d) {
      var f = readForm(d); if (!f.name) { toast('Give the project a name.', true); return false; }
      var p = await createProject(f); S.view = 'projects'; await openProject(p.id, 'files');
    });
  }
  function editProject(id) {
    if (needW()) return; var p = proj(id);
    modal('Edit project', projForm(p, { version: true }), 'Save', async function (d) {
      var f = readForm(d); if (!f.name) { toast('Give the project a name.', true); return false; }
      var upd = { name: f.name, description: f.description, category: f.category, stage: f.stage, folder_id: f.folder_id, url: f.url, version: f.version || null };
      if (upd.url !== p.url) { upd.monitor_state = 'unknown'; upd.last_error = null; upd.response_ms = null; upd.last_checked = null; }
      await touch(id, upd); if (S.pid) renderWorkspace(); else render();
    });
  }
  async function saveDetails() {
    if (needW()) return; var p = proj(), d = $('stDet'), f = readForm(d), en = d.querySelector('[name="entry"]');
    if (!f.name) return toast('Give the project a name.', true);
    var upd = { name: f.name, description: f.description, category: f.category, stage: f.stage, folder_id: f.folder_id, url: f.url, version: f.version || null, entry_path: en ? en.value : p.entry_path };
    if (upd.url !== p.url) { upd.monitor_state = 'unknown'; upd.last_error = null; upd.response_ms = null; upd.last_checked = null; }
    try { await touch(p.id, upd); if (f.stage !== p.stage) await hist(p.id, 'status', 'Stage changed to ' + STAGES[f.stage]); toast('Saved'); renderWorkspace(); } catch (e) { toast(e.message || String(e), true); }
  }
  function moveProject(id) {
    if (needW()) return; var p = proj(id);
    modal('Move “' + p.name + '”', '<label>Folder</label><select name="to">' + folderOpts(p.folder_id) + '</select>', 'Move', async function (d) {
      var to = d.querySelector('[name="to"]').value || null; await touch(id, { folder_id: to }); await hist(id, 'move', 'Moved to ' + (to ? fpath(to).map(function (f) { return f.name; }).join(' / ') : 'top level')); render();
    });
  }
  async function delProject(id) {
    if (needW()) return; var p = proj(id);
    if (!confirm('Delete "' + p.name + '" and ALL its files permanently? Other projects are not affected.')) return;
    var typed = prompt('Type the project name to confirm:'); if (typed === null) return; if (typed.trim() !== p.name) return toast('Name did not match. Nothing was deleted.', true);
    var pg = progress('Deleting ' + p.name);
    try {
      var rows = await loadFiles(id, true);
      for (var k = 0; k < rows.length; k += 100) { var rm = await sb.storage.from(BUCKET).remove(rows.slice(k, k + 100).map(function (r) { return id + '/' + r.id; })); if (rm.error) throw rm.error; pg.set('Removing files…', k / Math.max(1, rows.length) * 100); }
      var r = await sb.from('acacia_studio_projects').delete().eq('id', id); if (r.error) throw r.error;
    } catch (e) { pg.done(); return toast(e.message || String(e), true); }
    pg.done(); S.projects = S.projects.filter(function (x) { return x.id !== id; }); S.history = S.history.filter(function (h) { return h.project_id !== id; }); delete S.files[id]; S.pid = null; S.dirty = false; if (S.view === 'overview') S.view = 'projects'; render();
  }
  function logDeploy() {
    if (needW()) return; var p = proj();
    modal('Log a deployment', '<label>Version</label><input name="version" value="' + esc(p.version || '') + '" placeholder="e.g. 1.2.0"><label>What changed?</label><textarea name="note" rows="3" placeholder="e.g. Deployed new checkout page to production"></textarea>', 'Log deployment', async function (d) {
      var v = d.querySelector('[name="version"]').value.trim(), n = d.querySelector('[name="note"]').value.trim();
      await touch(p.id, { version: v || p.version || null, last_deployed_at: new Date().toISOString() }); await hist(p.id, 'deploy', n || 'Deployment', v); renderMonitorTab();
    });
  }
  async function handleImport(files, kind) {
    if (needW() || !files.length) return; var entries, def = '';
    try {
      if (kind === 'zip') { entries = cleanEntries(await zipEntries(files[0])); def = files[0].name.replace(/\.zip$/i, ''); }
      else { entries = cleanEntries(Array.from(files).map(function (f) { return { path: f.webkitRelativePath || f.name, blob: f }; })); def = (files[0].webkitRelativePath || '').split('/')[0] || 'New project'; }
    } catch (e) { return toast('Could not read the file: ' + e.message, true); }
    if (!entries.length) return toast('No usable files found (node_modules, .git and system files are skipped).', true);
    var tot = 0; entries.forEach(function (e) { tot += e.blob ? e.blob.size : 0; });
    modal('Import as a new project', '<p class="st-mut">' + entries.length + ' files found' + (tot ? ' · ' + fmtSize(tot) : '') + '. This creates a brand-new project; no existing project is changed.</p>' + projForm({ name: def, folder_id: S.folder }), 'Upload', async function (d) {
      var f = readForm(d); if (!f.name) { toast('Give the project a name.', true); return false; }
      closeModal(); var p = await createProject(f);
      var r = await importInto(p.id, entries, 'Uploading ' + p.name);
      var paths = (S.files[p.id] || []).map(function (x) { return x.path; });
      await touch(p.id, { entry_path: pickEntry(paths) }); await hist(p.id, 'upload', r.ok + ' file(s) imported from ' + (kind === 'zip' ? 'ZIP' : 'folder') + (r.errs.length ? ', ' + r.errs.length + ' failed' : ''));
      if (r.errs.length) toast(r.errs.length + ' file(s) failed: ' + r.errs[0], true);
      S.view = 'projects'; await openProject(p.id, 'files'); return false;
    }, true);
  }
  function importFromHub() {
    if (needW()) return; var sites = (typeof websites !== 'undefined' && websites) ? websites : [];
    if (!sites.length) return toast('The Website Manager has no sites to import.', true);
    modal('Import from Website Manager', '<p class="st-mut">Copies the selected sites into the Studio as new projects. Your Website Manager entries stay exactly as they are.</p><div class="st-pick">' + sites.map(function (s, i) { return '<label class="st-chk"><input type="checkbox" value="' + i + '"> ' + esc(s.name) + ' <span class="st-mut">' + (s.hasSource ? 'HTML source' : s.url ? esc(s.url) : '') + '</span></label>'; }).join('') + '</div>', 'Import selected', async function (d) {
      var picks = Array.from(d.querySelectorAll('input:checked')).map(function (c) { return sites[Number(c.value)]; });
      if (!picks.length) { toast('Tick at least one site.', true); return false; }
      closeModal(); var pg = progress('Importing'), n = 0;
      try {
        for (var i = 0; i < picks.length; i++) {
          var s = picks[i]; pg.set('Importing ' + s.name + '…', i / picks.length * 100);
          var p = await createProject({ name: s.name, description: 'Imported from Website Manager', category: 'Web app', stage: 'live', url: s.url || (s.file && s.file !== '#' && /^https?:/i.test(s.file) ? s.file : null), folder_id: S.folder });
          if (s.hasSource) { var r = await sb.from('acacia_hub_sites').select('source').eq('id', s.id).maybeSingle(); var src = (r.data && r.data.source) || (window.getSiteSource && window.getSiteSource(s.id)); if (src) { await putMany(p.id, [{ path: 'index.html', blob: new Blob([src], { type: 'text/html' }) }]); await touch(p.id); } }
          if (p.url) checkProject(p); n++;
        }
      } catch (e) { toast(e.message || String(e), true); } finally { pg.done(); }
      toast(n + ' project(s) imported'); S.view = 'projects'; render(); return false;
    }, true);
  }


  /* ---------------- home page: developer overview ---------------- */
  var homeBusy = false, homeTries = 0;
  function renderHome() {
    var el = $('stHome'); if (!el) return;
    var T = '<div class="st-ch"><h3 style="font-size:18px">🛠 Developer Overview</h3><div class="st-ha"><button class="st-b sm" data-h="all">Open My Development Studio →</button></div></div>';
    if (S.err) {
      var msg = String(S.err && S.err.message || S.err), missing = /does not exist|schema cache|relation|Could not find/i.test(msg);
      el.innerHTML = '<div class="st-card">' + T + '<p class="st-mut">' + (missing ? 'Run <code>acacia_studio.sql</code> once in Supabase → SQL Editor to switch on project tracking here.' : esc(msg)) + '</p><button class="st-b sm" data-h="retry">⟳ Try again</button></div>'; return;
    }
    if (!S.loaded) { el.innerHTML = '<div class="st-card">' + T + '<p class="st-mut">Loading your projects…</p></div>'; return; }
    var live = S.projects.filter(function (p) { return p.monitor_state === 'online' && p.stage !== 'archived'; }).length;
    var dev = S.projects.filter(function (p) { return p.stage === 'development'; }).length;
    var down = S.projects.filter(function (p) { return p.monitor_state === 'offline' && p.stage !== 'archived'; });
    var total = S.projects.reduce(function (a, p) { return a + sizeInfo(p).n; }, 0);
    var h = '<div class="st-card" style="background:transparent;border:0;padding:0">' + T;
    if (down.length) h += '<div class="st-err">⚠ ' + down.length + ' website' + (down.length === 1 ? ' is' : 's are') + ' offline: ' + down.map(function (p) { return esc(p.name); }).join(', ') + '</div>';
    h += '<div class="st-cards"><div class="st-stat"><span>Total projects</span><b>' + S.projects.length + '</b></div><div class="st-stat"><span>Online websites</span><b class="g">' + live + '</b></div><div class="st-stat"><span>In development</span><b class="a">' + dev + '</b></div><div class="st-stat"><span>Folders</span><b>' + S.folders.length + '</b></div><div class="st-stat"><span>Total size</span><b>' + fmtSize(total) + '</b></div></div>';
    h += '<div class="st-charts"><div class="st-card"><h3>Projects by status</h3><div class="st-cv"><canvas id="stCh1"></canvas></div></div><div class="st-card"><h3>Size by project</h3><div class="st-cv"><canvas id="stCh2"></canvas></div></div><div class="st-card"><h3>Activity · last 30 days</h3><div class="st-cv"><canvas id="stCh3"></canvas></div></div><div class="st-card"><h3 id="stCh4t">Website response time</h3><div class="st-cv" id="stCh4w"><canvas id="stCh4"></canvas></div></div></div>';
    h += '<div class="st-card"><div class="st-ch"><h3>Project list</h3>' + (canW() ? '<button class="st-b sm pri" data-h="newproj">＋ New project</button>' : '') + '</div>';
    if (!S.projects.length) h += '<p class="st-mut">No projects yet. Create one, or upload a ZIP or folder in the Studio.</p>';
    else {
      var rows = S.projects.slice().sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); }).slice(0, 8);
      h += '<div class="st-scroll"><table class="st-t"><thead><tr><th>Project</th><th>Status</th><th>Size</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (p) {
        return '<tr><td><b>' + esc(p.name) + '</b><div class="st-mut">' + esc(p.category) + ' · updated ' + ago(p.updated_at) + '</div></td><td>' + statusPill(p) + '</td><td>' + sizeCell(p) + '</td><td class="st-act"><button class="st-b sm" data-h="open" data-id="' + p.id + '" data-tab="preview">Preview</button><button class="st-b sm" data-h="open" data-id="' + p.id + '" data-tab="files">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (S.projects.length > 8 ? '<p style="margin-top:8px"><a class="st-lnk" data-h="all">View all ' + S.projects.length + ' projects →</a></p>' : '');
    }
    h += '</div><div class="st-card"><h3>Recent activity</h3>' + historyList(S.history.slice(0, 6), true) + '</div></div>';
    el.innerHTML = h; drawHomeCharts();
  }

  function drawHomeCharts() {
    (S.charts || []).forEach(function (c) { try { c.destroy(); } catch (e) { } }); S.charts = [];
    if (!$('stCh1')) return;
    if (typeof Chart === 'undefined') { ['stCh1', 'stCh2', 'stCh3', 'stCh4'].forEach(function (id) { var c = $(id); if (c) c.parentNode.innerHTML = '<p class="st-mut">Charts library not loaded.</p>'; }); return; }
    var dark = document.body.classList.contains('dark-mode'), tc = dark ? '#cbd5e1' : '#4b5563', gc = dark ? '#1c2f2d' : '#e5e7eb';
    var base = function (extra) { return Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc, boxWidth: 12 } } } }, extra || {}); };
    var axes = function (o) { return { x: Object.assign({ ticks: { color: tc, maxRotation: 0, autoSkip: true }, grid: { color: gc } }, o && o.x), y: Object.assign({ beginAtZero: true, ticks: { color: tc }, grid: { color: gc } }, o && o.y) }; };
    var empty = function (id, msg) { var c = $(id); if (c) c.parentNode.innerHTML = '<p class="st-mut" style="padding:20px 0;text-align:center">' + msg + '</p>'; };
    var mk = function (id, cfg) { var c = $(id); if (c) S.charts.push(new Chart(c, cfg)); };
    /* 1 status */
    var colors = { Online: '#16a34a', Offline: '#dc2626', Development: '#f59e0b', 'Not checked': '#3b82f6', Live: '#3b82f6', Maintenance: '#8b5cf6', Archived: '#9ca3af' }, cnt = {};
    S.projects.forEach(function (p) { var t = badge(p).t; cnt[t] = (cnt[t] || 0) + 1; });
    var ks = Object.keys(cnt);
    if (!ks.length) empty('stCh1', 'No projects yet.');
    else mk('stCh1', { type: 'doughnut', data: { labels: ks, datasets: [{ data: ks.map(function (k) { return cnt[k]; }), backgroundColor: ks.map(function (k) { return colors[k] || '#9ca3af'; }), borderWidth: 0 }] }, options: base({ cutout: '62%', plugins: { legend: { position: 'right', labels: { color: tc, boxWidth: 12 } } } }) });
    /* 2 size */
    var sz = S.projects.map(function (p) { return { n: p.name, v: sizeInfo(p).n }; }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    if (!sz.length) empty('stCh2', 'No uploaded files yet. Projects that only use a live URL have no stored size.');
    else { var mb = sz[0].v >= 1048576, div = mb ? 1048576 : 1024, unit = mb ? 'MB' : 'KB'; mk('stCh2', { type: 'bar', data: { labels: sz.map(function (x) { return x.n.length > 16 ? x.n.slice(0, 15) + '…' : x.n; }), datasets: [{ label: 'Size (' + unit + ')', data: sz.map(function (x) { return +(x.v / div).toFixed(2); }), backgroundColor: '#22615D', borderRadius: 4 }] }, options: base({ indexAxis: 'y', plugins: { legend: { display: false } }, scales: axes() }) }); }
    /* 3 activity, 30 days */
    var days = [], idx = {}, i;
    for (i = 29; i >= 0; i--) { var dt = new Date(Date.now() - i * 864e5), k = dt.toLocaleDateString('en-CA'); idx[k] = days.length; days.push({ k: k, l: dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), u: 0, e: 0, d: 0 }); }
    var any = 0; (S.act || []).forEach(function (h) { var j = idx[new Date(h.created_at).toLocaleDateString('en-CA')]; if (j === undefined) return; any++; if (h.kind === 'deploy') days[j].d++; else if (h.kind === 'upload' || h.kind === 'created') days[j].u++; else if (h.kind !== 'status') days[j].e++; });
    if (!any) empty('stCh3', 'No activity in the last 30 days.');
    else mk('stCh3', { type: 'bar', data: { labels: days.map(function (x) { return x.l; }), datasets: [{ label: 'Uploads', data: days.map(function (x) { return x.u; }), backgroundColor: '#3b82f6' }, { label: 'Edits', data: days.map(function (x) { return x.e; }), backgroundColor: '#f59e0b' }, { label: 'Deployments', data: days.map(function (x) { return x.d; }), backgroundColor: '#16a34a' }] }, options: base({ scales: { x: Object.assign(axes().x, { stacked: true }), y: Object.assign(axes().y, { stacked: true, ticks: { color: tc, precision: 0 } }) } }) });
    /* 4 response time */
    var chk = S.chk || [], ok = chk.filter(function (c) { return c.ok; });
    if (!chk.length) empty('stCh4', 'No website checks yet. Add a live URL to a project and press “Check now” in Monitoring.');
    else {
      var up = Math.round(ok.length / chk.length * 1000) / 10, t4 = $('stCh4t'); if (t4) t4.textContent = 'Website response time · ' + up + '% uptime (14 days)';
      var d14 = {}; ok.forEach(function (c) { var k = new Date(c.checked_at).toLocaleDateString('en-CA'); (d14[k] = d14[k] || []).push(c.ms || 0); });
      var ks14 = Object.keys(d14).sort();
      if (!ks14.length) empty('stCh4', 'All recent checks failed - no response times to chart.');
      else mk('stCh4', { type: 'line', data: { labels: ks14.map(function (k) { return new Date(k + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }), datasets: [{ label: 'Average response (ms)', data: ks14.map(function (k) { return Math.round(d14[k].reduce(function (a, b) { return a + b; }, 0) / d14[k].length); }), borderColor: '#22615D', backgroundColor: 'rgba(34,97,93,.15)', fill: true, tension: .3, pointRadius: 3 }] }, options: base({ scales: axes() }) });
    }
  }
  async function homeRefresh(force) {
    renderHome();
    sb = sb || window.__acxSb;
    if (!sb) { if (homeTries++ < 12) setTimeout(function () { homeRefresh(force); }, 1500); return; }
    if (homeBusy) return;
    if (!force && S.loaded && !S.err && S.projects.length && Date.now() - (S.loadedAt || 0) < 60000) return;
    homeBusy = true;
    try { await loadAll(); S.err = null; } catch (e) { S.err = e; }
    homeBusy = false; renderHome();
    if (!S.pid && !S.dirty && $('studio') && $('studio').classList.contains('active')) render();
  }
  function homeClick(e) {
    var t = e.target.closest('[data-h]'); if (!t) return; var a = t.dataset.h;
    if (a === 'retry') { S.err = null; S.loaded = false; return homeRefresh(true); }
    window.openPage('studio');
    if (a === 'open') openProject(t.dataset.id, t.dataset.tab);
    else if (a === 'all') { S.pid = null; S.view = 'projects'; render(); }
    else if (a === 'newproj') { S.pid = null; S.view = 'projects'; render(); newProject(); }
  }

  /* ---------------- dashboard switcher: Developer / Books ---------------- */
  function setMode(m, save) {
    var dash = $('dashboard'); if (!dash) return;
    if (save) localStorage.setItem('acacia_dash_mode', m);
    var dev = m === 'developer', cv = $('dashboardChart'), chart = cv && cv.closest('#dashboard > div'), grid = dash.querySelector(':scope > .grid'), rev = $('hubRevenueCard');
    if ($('stHome')) $('stHome').style.display = dev ? '' : 'none';
    [grid, chart, rev].forEach(function (el) { if (el) el.style.display = dev ? 'none' : ''; });
    var h1 = dash.querySelector('h1'), p = dash.querySelector('p.mt-2');
    if (h1) h1.textContent = dev ? 'Developer Dashboard' : 'Books Platform Overview';
    if (p) p.textContent = dev ? 'Everything you build and run, in one place: your websites and applications, their status and size.' : 'Users, companies, revenue, support and usage across Acacia Books.';
    Array.from(document.querySelectorAll('#stSwitch button')).forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
    if (dev) setTimeout(function () { try { drawHomeCharts(); } catch (e) { } }, 0);
    if (!dev && save && typeof window.loadDashboard === 'function') setTimeout(window.loadDashboard, 0);
  }

  /* ---------------- boot ---------------- */
  function css() {
    var s = document.createElement('style'); s.id = 'stCss';
    s.textContent = '#studio{padding:4px}#studio *,.st-scope *{box-sizing:border-box}.st-hd{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px}.st-tt{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.st-tt h1{font-size:22px;font-weight:700;margin:0}.st-ha{display:flex;gap:8px;align-items:center;margin-left:auto}.st-mut{color:#6b7280;font-size:12px}.st-b{border:1px solid #d1d5db;background:#fff;color:#111827;border-radius:8px;padding:7px 13px;font-size:13px;font-weight:500;cursor:pointer}.st-b:hover{background:#f3f4f6}.st-b.pri{background:#22615D;border-color:#22615D;color:#fff}.st-b.pri:hover{background:#1A4B48}.st-b.sm{padding:4px 9px;font-size:12px}.st-b.dng{color:#b91c1c;border-color:#fecaca}.st-b:disabled{opacity:.5;cursor:default}.st-tabs{display:flex;gap:4px;border-bottom:1px solid #e5e7eb;margin-bottom:14px;overflow-x:auto}.st-tabs button{background:none;border:0;border-bottom:3px solid transparent;padding:9px 14px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;white-space:nowrap}.st-tabs button.on{color:#22615D;border-bottom-color:#22615D}.st-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}.st-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px}.st-stat span{display:block;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}.st-stat b{font-size:30px;color:#0E2B29}.st-stat b.g{color:#15803d}.st-stat b.a{color:#b45309}.st-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:14px}.st-card h3{margin:0 0 8px;font-size:16px;font-weight:700}.st-card h4{margin:14px 0 6px;font-size:13px;font-weight:700}.st-ch{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}.st-ch h3{margin:0}.st-scroll{overflow-x:auto}.st-t{width:100%;border-collapse:collapse;font-size:14px}.st-t th{text-align:left;font-size:12px;color:#6b7280;padding:8px;border-bottom:1px solid #e5e7eb;background:transparent!important;color:#6b7280!important}.st-t td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.st-act{white-space:nowrap}.st-act .st-b{margin-right:4px}.st-bd{display:inline-block;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600}.st-bd.green{background:#dcfce7;color:#166534}.st-bd.amber{background:#fef3c7;color:#92400e}.st-bd.red{background:#fee2e2;color:#991b1b}.st-bd.blue{background:#dbeafe;color:#1e40af}.st-bd.gray{background:#e5e7eb;color:#374151}.st-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.st-q,#studio input,#studio select,#studio textarea{border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;font-size:13px;background:#fff;color:#111827}.st-q{min-width:200px}.st-crumb{font-size:13px;margin-bottom:10px;color:#6b7280}.st-crumb a,.st-lnk{color:#22615D;cursor:pointer;text-decoration:none}.st-crumb a:hover,.st-lnk:hover{text-decoration:underline}.st-folders{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:14px}.st-fold{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px}.st-fold a{cursor:pointer;flex:1}.st-fa button{background:none;border:0;cursor:pointer;opacity:.5;font-size:13px}.st-fa button:hover{opacity:1}.st-warn{background:#fef3c7;color:#92400e;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px}.st-note{background:#eff6ff;color:#1e3a8a;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px}.st-err{color:#b91c1c;font-size:13px}div.st-err{background:#fef2f2;border-radius:8px;padding:8px 12px;margin:8px 0}.hidden{display:none!important}.st-hl{list-style:none;margin:0;padding:0}.st-hl li{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px}.st-k{flex:0 0 64px;text-align:center;border-radius:6px;font-size:11px;font-weight:700;padding:2px 0;height:20px;background:#e5e7eb;color:#374151;text-transform:uppercase}.st-k.created,.st-k.deploy{background:#dcfce7;color:#166534}.st-k.upload,.st-k.move,.st-k.rename{background:#dbeafe;color:#1e40af}.st-k.edit{background:#fef3c7;color:#92400e}.st-k.delete{background:#fee2e2;color:#991b1b}.st-k.status{background:#ede9fe;color:#5b21b6}.st-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}.st-ex{display:grid;grid-template-columns:300px 1fr;gap:12px;min-height:70vh}@media(max-width:820px){.st-ex{grid-template-columns:1fr}}.st-side,.st-edit{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;max-height:78vh}.st-sbar{display:flex;gap:6px;padding:8px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}.st-sbar .st-q{min-width:0;flex:1}.st-tgt{padding:4px 10px}.st-tree{overflow:auto;flex:1;padding-bottom:10px;font-size:13px}.st-ti{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;cursor:pointer;white-space:nowrap;gap:6px}.st-ti span{overflow:hidden;text-overflow:ellipsis}.st-ti:hover{background:#f3f4f6}.st-ti.on{background:#e0f2f1;font-weight:600}.st-ti.cur{background:#f0fdfa}.st-ti em{display:none;font-style:normal}.st-ti:hover em{display:inline}.st-ti em button{background:none;border:0;cursor:pointer;font-size:12px}.st-ti.hit{display:block;white-space:normal}.st-edh{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}.st-dirty{color:#b45309;font-size:12px;font-weight:600}#stEd{flex:1;width:100%;min-height:55vh;border:0!important;border-radius:0!important;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:18px;padding:12px;resize:none;tab-size:2;white-space:pre;overflow:auto}#stEd:focus{outline:0}.st-foot{display:flex;justify-content:space-between;padding:6px 12px;border-top:1px solid #f1f5f9;font-size:12px;color:#6b7280}.st-empty,.st-img{padding:40px 20px;text-align:center;color:#6b7280}.st-img img{max-width:100%;max-height:60vh}.st-fw{margin:0 auto;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;background:#fff}.st-fw iframe{width:100%;height:100%;border:0;display:block;background:#fff}.st-fw.desktop{width:100%;height:72vh}.st-fw.tablet{width:768px;max-width:100%;height:72vh}.st-fw.mobile{width:390px;max-width:100%;height:72vh;border-radius:24px;border-width:6px;border-color:#1f2937}.st-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}.st-md{background:#fff;color:#111827;border-radius:14px;padding:20px;width:100%;max-width:460px;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)}.st-md.wide{max-width:560px}.st-md h3{margin:0 0 10px;font-size:18px}.st-mb label{display:block;font-size:12px;font-weight:600;margin:10px 0 4px;color:#374151}.st-mb input,.st-mb select,.st-mb textarea{width:100%}.st-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.st-mf{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.st-pt{font-size:13px;margin-bottom:8px}.st-pb{height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden}.st-pb i{display:block;height:100%;background:#22615D;transition:width .2s}.st-pick{max-height:300px;overflow:auto;border:1px solid #e5e7eb;border-radius:8px;padding:6px}.st-chk{display:flex!important;gap:8px;align-items:center;margin:0!important;padding:6px;font-weight:400!important}.st-chk input{width:auto!important}.st-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:14px}.st-charts .st-card{margin-bottom:0}.st-cv{position:relative;height:240px}.st-seg{display:inline-flex;background:#e5e7eb;border-radius:10px;padding:3px;margin:0 0 18px;gap:2px}.st-seg button{border:0;background:none;padding:7px 18px;border-radius:8px;font-size:13px;font-weight:600;color:#4b5563;cursor:pointer}.st-seg button.on{background:#fff;color:#22615D;box-shadow:0 1px 3px rgba(0,0,0,.15)}body.dark-mode .st-seg{background:#12302d}body.dark-mode .st-seg button{color:#9ca3af}body.dark-mode .st-seg button.on{background:#0F201F;color:#579A97}.st-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#0E2B29;color:#fff;padding:10px 18px;border-radius:10px;z-index:100002;font-size:13px;transition:opacity .4s;max-width:90vw}.st-toast.bad{background:#991b1b}.st-toast.out{opacity:0}body.dark-mode .st-scope .st-stat,body.dark-mode .st-scope .st-card,body.dark-mode .st-scope .st-fold,body.dark-mode .st-scope .st-side,body.dark-mode .st-scope .st-edit{background:#0F201F;border-color:#1c2f2d;color:#e5e7eb}body.dark-mode .st-scope .st-stat b{color:#579A97}body.dark-mode .st-scope .st-b{background:#0A1615;border-color:#1c2f2d;color:#e5e7eb}body.dark-mode .st-scope .st-b.pri{background:#22615D}body.dark-mode .st-scope input,body.dark-mode .st-scope select,body.dark-mode .st-scope textarea{background:#0A1615!important;color:#e5e7eb!important;border-color:#1c2f2d!important}body.dark-mode .st-scope .st-t td,body.dark-mode .st-scope .st-t th{border-color:#1c2f2d;background:transparent}body.dark-mode .st-scope .st-ti:hover{background:#12302d}body.dark-mode .st-scope .st-ti.on{background:#1A4B48}body.dark-mode .st-md{background:#0F201F;color:#e5e7eb}body.dark-mode .st-mb label{color:#cbd5e1}body.dark-mode .st-scope .st-tabs{border-color:#1c2f2d}';
    document.head.appendChild(s);
  }
  function mount() {
    if ($('studio')) return true; var ws = $('websites'); if (!ws) return false;
    css();
    var page = document.createElement('div'); page.className = 'page st-scope'; page.id = 'studio';
    page.innerHTML = '<div id="stRoot"></div><input type="file" id="stZip" accept=".zip" hidden><input type="file" id="stDir" webkitdirectory multiple hidden><input type="file" id="stUp" multiple hidden>';
    ws.insertAdjacentElement('afterend', page);
    var dash = $('dashboard');
    if (dash && !$('stHome')) {
      var home = document.createElement('div'); home.id = 'stHome'; home.className = 'st-scope'; home.style.marginBottom = '24px'; home.addEventListener('click', homeClick);
      var grid = dash.querySelector(':scope > .grid');
      if (grid) grid.insertAdjacentElement('beforebegin', home);
      else dash.appendChild(home);
    }
    if (dash && !$('stSwitch')) {
      var hdr = dash.querySelector('h1'); hdr = hdr && hdr.closest('#dashboard > div');
      var sw = document.createElement('div'); sw.id = 'stSwitch'; sw.className = 'st-seg st-scope';
      sw.innerHTML = '<button data-m="developer">🛠 Developer</button><button data-m="books">📚 Books</button>';
      sw.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m, true); });
      if (hdr) hdr.insertAdjacentElement('afterend', sw); else dash.insertBefore(sw, dash.firstChild);
      setMode(localStorage.getItem('acacia_dash_mode') === 'books' ? 'books' : 'developer', false);
    }
    var li = document.querySelector('button[onclick*="openPage(\'websites\')"]'); li = li && li.closest('li');
    if (li) { var n = document.createElement('li'); n.innerHTML = '<button onclick="openPage(\'studio\')">🛠 Dev Studio</button>'; li.insertAdjacentElement('afterend', n); }
    var root = $('stRoot');
    page.addEventListener('click', function (e) { var t = e.target.closest('[data-a]'); if (!t || !page.contains(t)) return; if (t.closest('[data-a]') !== t) t = e.target.closest('[data-a]'); e.stopPropagation(); act(t.dataset.a, t.dataset, t).catch(function (err) { console.error('[studio]', err); toast(err && err.message || String(err), true); }); });
    page.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'stZip') { handleImport(t.files, 'zip'); t.value = ''; }
      else if (t.id === 'stDir') { handleImport(t.files, 'dir'); t.value = ''; }
      else if (t.id === 'stUp') { uploadFiles(Array.from(t.files)).catch(function (er) { toast(er.message || String(er), true); }); t.value = ''; }
      else if (t.id === 'stPage') loadPreview(t.value);
      else if (t.id === 'stSrc') { S.prevMode = t.value; renderWorkspace(); }
      else if (t.id === 'stAuto') { S.auto = Number(t.value); localStorage.setItem('acacia_studio_auto', String(S.auto)); }
      else if (t.id === 'stFm') { S.qmode = t.value; S.hits = null; renderTree(); }
    });
    var qt = null;
    page.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'stEd') { markDirty(true); var s = $('stLc'); if (s) s.textContent = t.value.split('\n').length + ' lines'; }
      else if (t.id === 'stSearch') { S.search = t.value; clearTimeout(qt); qt = setTimeout(function () { render(); var x = $('stSearch'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); }
      else if (t.id === 'stFq') { S.q = t.value; S.hits = null; clearTimeout(qt); qt = setTimeout(function () { if (S.qmode === 'code' && S.q.trim().length >= 2) searchCode(S.q.trim()); else renderTree(); }, 350); }
    });
    page.addEventListener('keydown', function (e) {
      if (e.target.id !== 'stEd') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); }
      else if (e.key === 'Tab') { e.preventDefault(); var t = e.target, a = t.selectionStart; t.value = t.value.slice(0, a) + '  ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = a + 2; markDirty(true); }
    });
    window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
    return true;
  }
  function onOpen() {
    sb = sb || window.__acxSb;
    if (!sb) { S.err = new Error('The cloud connection is not available. Check your internet connection and reload.'); return render(); }
    if (S.loaded && !S.err && Date.now() - (S.loadedAt || 0) < 60000) return render();
    S.err = null; render(); refresh(true);
  }
  function init() {
    if (!mount()) return setTimeout(init, 300);
    var _ld = window.loadDashboard;
    if (typeof _ld === 'function') window.loadDashboard = function () { var r = _ld.apply(this, arguments); try { homeRefresh(); } catch (e) { console.warn('[studio] home', e); } return r; };
    homeRefresh();
    var _op = window.openPage;
    window.openPage = function (id) { if (S.dirty && id !== 'studio' && S.pid && !confirm('You have unsaved changes in the Studio. Leave without saving?')) return; if (id !== 'studio') S.dirty = false; var r = _op.apply(this, arguments); if (id === 'studio') onOpen(); return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
