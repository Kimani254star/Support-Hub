/* acacia-gate.js  -  one shared approval / expiry check for every Acacia app.
   Add before </body> in each app:   <script src="acacia-gate.js"></script>
   Reads public.acacia_company_status (managed from the Support Hub).
   Missing row = existing customer (allowed). Offline = keeps last known state. */
(function(){
  if (window.__acxGate) return; window.__acxGate = true;
  var CS = document.currentScript;
  var APP = window.ACX_APP || (CS && CS.getAttribute('data-app')) || (document.title || 'App').slice(0, 40);
  var URL_ = window.__SUPA_URL__ || 'https://xglsampckermarjpczdf.supabase.co';
  var KEY_ = window.__SUPA_KEY__ || 'sb_publishable_x-dPR7pzhvJgag9soW0I8w_yfKTmi6A';
  var H = { apikey: KEY_, Authorization: 'Bearer ' + KEY_, 'Content-Type': 'application/json' };
  var SESSION_KEYS = ['loggedInUser', 'acaciaCrmSession', 'acaciaSession', 'currentUser', 'session'];
  var USER_LISTS   = ['users', 'acaciaCrmUsers'];

  function parse(v){ try { return JSON.parse(v); } catch(e){ return v; } }
  function session(){
    for (var i = 0; i < SESSION_KEYS.length; i++){
      var raw = localStorage.getItem(SESSION_KEYS[i]); if (!raw) continue;
      var o = parse(raw);
      if (o && typeof o === 'object'){
        var id = o.companyId || o.company_id || o.company;
        if (id) return { companyId: String(id), obj: o, key: SESSION_KEYS[i] };
        o = o.email || o.username || o.user;               /* session holds only who signed in */
      }
      if (typeof o === 'string' && o){
        o = o.toLowerCase();
        for (var j = 0; j < USER_LISTS.length; j++){
          var list = parse(localStorage.getItem(USER_LISTS[j]) || '[]');
          if (!Array.isArray(list)) continue;
          var u = list.find(function(x){ return x && ((x.email || '').toLowerCase() === o || (x.username || '').toLowerCase() === o); });
          if (u && (u.companyId || u.company_id)) return { companyId: String(u.companyId || u.company_id), obj: u, key: SESSION_KEYS[i] };
        }
      }
    }
    return null;
  }
  function effective(row){
    if (!row) return 'active';
    if (row.status === 'active' && row.paid_until && new Date(row.paid_until) < new Date()) return 'expired';
    return row.status;
  }
  async function fetchRow(id){
    var r = await fetch(URL_ + '/rest/v1/acacia_company_status?select=*&company_id=eq.' + encodeURIComponent(id), { headers: H });
    if (!r.ok) throw new Error('status ' + r.status);
    var a = await r.json(); return a[0] || null;
  }
  async function createPending(s){
    var u = s.obj, row = { company_id: s.companyId, company_name: u.companyName || '', owner_name: u.fullName || u.username || '',
      email: u.email || '', plan: u.plan || 'Free', price: Number(u.price || 0), status: 'pending' };
    await fetch(URL_ + '/rest/v1/acacia_company_status', { method: 'POST',
      headers: Object.assign({ Prefer: 'resolution=ignore-duplicates,return=minimal' }, H), body: JSON.stringify(row) });
    return row;
  }
  var MSG = {
    pending:   ['Awaiting approval', 'Your account has been created and is waiting for approval by our team. You will be able to use it as soon as it is approved.'],
    expired:   ['Subscription expired', 'Your payment period has ended and this account has been deactivated. Renew your subscription to get access again.'],
    suspended: ['Account deactivated', 'This account has been deactivated. Please contact support or renew your subscription.'],
    rejected:  ['Registration not approved', 'This registration was not approved. Please contact support for help.']
  };
  function heartbeat(s){
    try {
      var u = (s.obj.email || s.obj.username || '').toLowerCase(); if (!u) return;
      var k = 'acx_hb_' + s.companyId + '_' + APP + '_' + u, last = Number(localStorage.getItem(k) || 0);
      if (Date.now() - last < 5 * 60 * 1000) return;
      localStorage.setItem(k, String(Date.now()));
      fetch(URL_ + '/rest/v1/rpc/acx_heartbeat', { method: 'POST', headers: H, keepalive: true,
        body: JSON.stringify({ p_company: s.companyId, p_app: APP, p_user: u, p_role: String(s.obj.role || '') }) });
    } catch(e){}
  }
  function unlock(){ var o = document.getElementById('acxLock'); if (o) o.remove(); }
  function lock(st, s){
    var m = MSG[st] || MSG.suspended, o = document.getElementById('acxLock');
    if (!o){
      o = document.createElement('div'); o.id = 'acxLock';
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0b1220;color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif';
      document.body.appendChild(o);
    }
    o.innerHTML = '<div style="max-width:440px;text-align:center"><div style="font-size:42px;margin-bottom:8px">' + (st === 'pending' ? '\u23F3' : '\uD83D\uDD12') + '</div>' +
      '<h2 style="font-size:22px;font-weight:700;margin:0 0 10px">' + m[0] + '</h2><p style="color:#94a3b8;line-height:1.6;margin:0 0 22px">' + m[1] + '</p>' +
      '<button id="acxLockRetry" style="background:#2563eb;color:#fff;border:0;border-radius:8px;padding:10px 18px;margin:4px;cursor:pointer">Check again</button>' +
      (st === 'expired' || st === 'suspended' ? '<a href="payment.html" style="display:inline-block;background:#16a34a;color:#fff;border-radius:8px;padding:10px 18px;margin:4px;text-decoration:none">Renew</a>' : '') +
      '<button id="acxLockOut" style="background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:8px;padding:10px 18px;margin:4px;cursor:pointer">Sign out</button></div>';
    document.getElementById('acxLockRetry').onclick = function(){ check(); };
    document.getElementById('acxLockOut').onclick = function(){
      SESSION_KEYS.forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} }); location.reload(); };
  }
  async function check(){
    var s = session(); if (!s) { unlock(); return; }
    var ck = 'acx_gate_' + s.companyId;
    try {
      var row = await fetchRow(s.companyId);
      if (!row){
        var reg = s.obj.registered || s.obj.createdAt;
        var fresh = reg && (Date.now() - new Date(reg).getTime() < 15 * 60 * 1000);
        if (!fresh) { localStorage.setItem(ck, 'active'); unlock(); return; }
        await createPending(s); row = { status: 'pending' };
      }
      var st = effective(row);
      localStorage.setItem(ck, st);
      if (st === 'active') { unlock(); heartbeat(s); } else lock(st, s);
    } catch(e){
      var c = localStorage.getItem(ck);
      if (c && c !== 'active') lock(c, s);
    }
  }
  window.acxCheckAccount = check;
  window.addEventListener('storage', function(e){ if (SESSION_KEYS.indexOf(e.key) > -1) setTimeout(check, 300); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) check(); });
  setInterval(check, 60000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(check, 1200); });
  else setTimeout(check, 1200);
})();
