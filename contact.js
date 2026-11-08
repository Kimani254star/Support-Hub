/* =====================================================================
   Get in touch - advanced contact form (contact.js)
   Replaces the old form that discarded messages. Saves every request to
   Supabase (table acacia_contact_requests, see acacia_contact.sql) so it
   appears in the Developer hub. Edit the CONFIG block below.
   ===================================================================== */
(function () {
  'use strict';
  var CONFIG = {
    email: 'hello@example.com',   // <-- put your real email here
    whatsapp: '',                 // <-- optional, digits only with country code, e.g. 254712345678
    table: 'acacia_contact_requests'
  };
  var SERVICES = ['Acacia Books (accounting & business software)', 'Website', 'Web app / system', 'Dashboard / reports', 'E-commerce', 'Mobile app', 'Fix or maintain existing', 'Something else'];
  var BUDGETS = ['Not sure yet', 'Small (quick fix or simple page)', 'Medium (full website or app)', 'Large (system with many modules)', "Let's discuss"];
  var TIMELINES = ['As soon as possible', 'Within 1 month', '1 to 3 months', 'Just exploring'];
  var VIA = ['Email', 'WhatsApp', 'Phone call'];
  var URL_ = window.__SUPA_URL__ || 'https://xglsampckermarjpczdf.supabase.co';
  var KEY_ = window.__SUPA_KEY__ || 'sb_publishable_x-dPR7pzhvJgag9soW0I8w_yfKTmi6A';
  var started = Date.now(), client = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function getClient() { if (!client && window.supabase) client = window.supabase.createClient(URL_, KEY_, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); return client; }

  function css() {
    var s = document.createElement('style');
    s.textContent = '#contact .cf-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:640px){#contact .cf-grid{grid-template-columns:1fr}}' +
      '#contact .hp-form select{width:100%;padding:13px 14px;background:var(--hp-input);border:1px solid var(--hp-line);color:var(--hp-ink);border-radius:8px;font:inherit}#contact .hp-form select:focus{outline:none;border-color:var(--hp-accent);box-shadow:0 0 0 3px rgba(37,99,235,.18)}' +
      '#contact .cf-chips{display:flex;flex-wrap:wrap;gap:8px;border:0;padding:0;margin:0}#contact .cf-chips legend{font-size:14px;font-weight:600;color:var(--hp-ink);padding:0;margin-bottom:8px}' +
      '#contact .cf-chip{position:relative}#contact .cf-chip input{position:absolute;opacity:0;inset:0;cursor:pointer;width:100%;height:100%}#contact .cf-chip span{display:inline-block;padding:8px 14px;border:1px solid var(--hp-line);border-radius:99px;font-size:13px;font-weight:600;color:var(--hp-ink);background:var(--hp-input);transition:.2s}#contact .cf-chip input:checked+span{background:var(--hp-accent);border-color:var(--hp-accent);color:#fff}#contact .cf-chip input:focus-visible+span{box-shadow:0 0 0 3px rgba(37,99,235,.3)}' +
      '#contact .cf-hint{font-size:12px;font-weight:400;opacity:.65}#contact .cf-count{font-size:12px;opacity:.6;justify-self:end;font-weight:400}#contact .cf-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;padding:10px 12px;font-size:14px}#contact .cf-hp{position:absolute!important;left:-9999px;height:0;overflow:hidden}' +
      '#contact .cf-check{display:flex!important;grid-template-columns:none!important;gap:10px;align-items:flex-start;font-weight:400!important;font-size:13px!important}#contact .cf-check input{width:auto!important;margin-top:3px}' +
      '#contact .cf-ok{text-align:left}#contact .cf-ok .cf-tick{width:52px;height:52px;border-radius:50%;background:#dcfce7;color:#166534;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:12px}#contact .cf-ref{display:inline-block;background:var(--hp-input);border:1px dashed var(--hp-line);border-radius:8px;padding:6px 12px;font-family:ui-monospace,Menlo,monospace;font-weight:700;letter-spacing:.06em}#contact .cf-steps{margin:16px 0;padding-left:0;list-style:none;display:grid;gap:10px}#contact .cf-steps li{display:flex;gap:10px;font-size:14px}#contact .cf-steps b{flex:0 0 24px;height:24px;border-radius:50%;background:var(--hp-accent);color:#fff;text-align:center;font-size:12px;line-height:24px}#contact .cf-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}';
    document.head.appendChild(s);
  }
  function opts(a, ph) { return (ph ? '<option value="">' + ph + '</option>' : '') + a.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join(''); }
  function formHtml() {
    return '<form class="hp-form" id="cfForm" novalidate>' +
      '<fieldset class="cf-chips"><legend>What do you need?</legend>' + SERVICES.map(function (s, i) { return '<label class="cf-chip"><input type="radio" name="cfService" value="' + esc(s) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(s) + '</span></label>'; }).join('') + '</fieldset>' +
      '<div class="cf-grid"><label>Your name<input id="cfName" required autocomplete="name" maxlength="120"></label><label>Email address<input id="cfEmail" type="email" required autocomplete="email" maxlength="200"></label></div>' +
      '<div class="cf-grid"><label>Phone / WhatsApp <span class="cf-hint">(optional)</span><input id="cfPhone" type="tel" autocomplete="tel" maxlength="40" placeholder="+254 …"></label><label>Best way to reach you<select id="cfVia">' + opts(VIA) + '</select></label></div>' +
      '<div class="cf-grid"><label>Budget <span class="cf-hint">(optional)</span><select id="cfBudget">' + opts(BUDGETS, 'Choose…') + '</select></label><label>When do you need it? <span class="cf-hint">(optional)</span><select id="cfTimeline">' + opts(TIMELINES, 'Choose…') + '</select></label></div>' +
      '<label>What are you building?<textarea id="cfMsg" required rows="5" maxlength="4000" placeholder="Tell me what it should do, who will use it, and anything you already have (a design, a website, a spreadsheet)."></textarea><span class="cf-count" id="cfCount">0 / 4000</span></label>' +
      '<div class="cf-hp" aria-hidden="true"><label>Leave this empty<input id="cfWeb" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="cf-check"><input type="checkbox" id="cfOk"> <span>I agree to be contacted about this request.</span></label>' +
      '<div id="cfErr" class="cf-err hidden" role="alert"></div>' +
      '<button type="submit" class="hp-btn" id="cfBtn">Send message <i class="fa-solid fa-paper-plane"></i></button></form>';
  }
  function showErr(m) { var e = document.getElementById('cfErr'); if (!e) return; e.innerHTML = m; e.classList.remove('hidden'); e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function mailtoFallback(d) { return 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Project enquiry from ' + d.name) + '&body=' + encodeURIComponent(d.message + '\n\n' + d.name + '\n' + d.email + (d.phone ? '\n' + d.phone : '')); }

  async function submit(e) {
    e.preventDefault();
    var btn = document.getElementById('cfBtn'), svc = document.querySelector('input[name="cfService"]:checked');
    var d = { name: val('cfName'), email: val('cfEmail'), phone: val('cfPhone'), contact_via: val('cfVia'), budget: val('cfBudget'), timeline: val('cfTimeline'), message: val('cfMsg'), service: svc ? svc.value : '' };
    var er = document.getElementById('cfErr'); er.classList.add('hidden');
    if (d.name.length < 2) return showErr('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return showErr('Please enter a valid email address.');
    if (d.contact_via !== 'Email' && d.phone.replace(/\D/g, '').length < 7) return showErr('Add a phone or WhatsApp number so I can reach you that way, or choose Email.');
    if (d.message.length < 10) return showErr('Please tell me a little more about the project (at least a sentence).');
    if (!document.getElementById('cfOk').checked) return showErr('Please tick the box so I know I can reply to you.');
    if (val('cfWeb') || Date.now() - started < 2500) return done(d, 'REQ-' + uuid().slice(0, 6).toUpperCase());   // bots: pretend success, send nothing
    var log = []; try { log = JSON.parse(localStorage.getItem('acacia_cf_log') || '[]').filter(function (t) { return Date.now() - t < 864e5; }); } catch (x) { }
    if (log.length && Date.now() - log[log.length - 1] < 60000) return showErr('Please wait a minute before sending another message.');
    if (log.length >= 5) return showErr('You have sent several messages today. I will reply to them soon, or email me directly at <a href="mailto:' + esc(CONFIG.email) + '">' + esc(CONFIG.email) + '</a>.');
    var c = getClient(); if (!c) return showErr('Could not connect. Please check your internet connection, or <a href="' + esc(mailtoFallback(d)) + '">email me instead</a>.');
    var id = uuid(), ref = 'REQ-' + id.slice(0, 6).toUpperCase();
    btn.disabled = true; btn.innerHTML = 'Sending…';
    try {
      var row = { id: id, ref: ref, name: d.name, email: d.email, phone: d.phone || null, service: d.service, channel: /books/i.test(d.service || '') ? 'books' : 'developer', budget: d.budget || null, timeline: d.timeline || null, contact_via: d.contact_via, message: d.message, source_url: location.href.split('#')[0].slice(0, 400), user_agent: (navigator.userAgent || '').slice(0, 300) };
      var r = await c.from(CONFIG.table).insert(row); if (r.error) throw r.error;
      log.push(Date.now()); localStorage.setItem('acacia_cf_log', JSON.stringify(log));
      done(d, ref);
    } catch (err) {
      btn.disabled = false; btn.innerHTML = 'Send message <i class="fa-solid fa-paper-plane"></i>';
      var m = String(err && err.message || err); if (/too many|busy/i.test(m)) return showErr(esc(m));
      showErr('Sorry, your message could not be sent. Please <a href="' + esc(mailtoFallback(d)) + '">email me instead</a> - nothing was lost, your text is still in the form.');
    }
  }
  function done(d, ref) {
    var host = document.querySelector('#contact .hp-form-card'); if (!host) return;
    host.innerHTML = '<div class="cf-ok"><div class="cf-tick">✓</div><h3 style="font-size:22px;font-weight:700;margin:0 0 6px">Message received, ' + esc(d.name.split(' ')[0]) + '.</h3><p>Your reference is <span class="cf-ref">' + esc(ref) + '</span></p>' +
      '<ul class="cf-steps"><li><b>1</b><span>I read your message personally, usually the same or next working day.</span></li><li><b>2</b><span>I reply by ' + esc((d.contact_via || 'Email').toLowerCase()) + ' with questions or a first suggestion.</span></li><li><b>3</b><span>If it is a fit, we agree the plan and I start building in small, visible steps.</span></li></ul>' +
      '<div class="cf-btns"><button type="button" class="hp-btn ghost" id="cfAgain">Send another message</button>' + (CONFIG.whatsapp ? '<a class="hp-btn ghost" target="_blank" rel="noopener" href="https://wa.me/' + esc(CONFIG.whatsapp) + '?text=' + encodeURIComponent('Hi, I just sent a request on your website (' + ref + ').') + '">Chat on WhatsApp</a>' : '') + '</div></div>';
    host.dataset.up = ''; document.getElementById('cfAgain').onclick = function () { started = Date.now(); build(); };
    host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function build() {
    var host = document.querySelector('#contact .hp-form-card'); if (!host || host.dataset.up) return; host.dataset.up = '1';
    host.innerHTML = formHtml();
    document.getElementById('cfForm').addEventListener('submit', submit);
    var m = document.getElementById('cfMsg'), n = document.getElementById('cfCount'); m.addEventListener('input', function () { n.textContent = m.value.length + ' / 4000'; });
    var via = document.getElementById('cfVia'), ph = document.getElementById('cfPhone'); via.addEventListener('change', function () { ph.required = via.value !== 'Email'; });
  }
  function init() {
    if (!document.getElementById('contact')) return;
    css(); build(); window.submitContactForm = function (e) { if (e && e.preventDefault) e.preventDefault(); return false; };
    var list = document.querySelector('#contact .hp-contact-list');
    if (list) list.innerHTML = '<div><i class="fa-solid fa-envelope"></i> <a href="mailto:' + esc(CONFIG.email) + '">' + esc(CONFIG.email) + '</a></div>' + (CONFIG.whatsapp ? '<div><i class="fa-brands fa-whatsapp"></i> <a target="_blank" rel="noopener" href="https://wa.me/' + esc(CONFIG.whatsapp) + '">WhatsApp me</a></div>' : '') + '<div><i class="fa-solid fa-clock"></i> I usually reply within one working day.</div>';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
