/**
 * The website chat widget as a plain script (Unit 4.2, 2026-09-23).
 *
 * Why a plain script: a React component imported by the public layout is
 * bundled into the layout's shared chunk and loaded on every page, even when
 * it renders nothing. This script is served by its own route and added to a
 * page only when the chat is switched on, so while it is off the public site
 * loads exactly what it loaded before.
 *
 * The script builds its own DOM, writes every piece of text with textContent
 * (never innerHTML), keeps its styles inline, and talks to one endpoint:
 * /api/growth/chat on the public site, or the admin preview endpoint when the
 * script tag says so. It reads the page path from the address bar.
 */

export function widgetScript(): string {
  return `(() => {
  const me = document.currentScript;
  if (!me || window.__pmbcChat) return;
  window.__pmbcChat = true;
  const endpoint = me.dataset.endpoint || '/api/growth/chat';
  const mount = me.dataset.container ? document.getElementById(me.dataset.container) : null;
  const preview = Boolean(mount);
  const NAVY = '#1B3A5F', INK = '#0F1B2D', CREAM = '#FAF7F2', MUTED = '#6B7280';
  const path = () => (me.dataset.path || location.pathname || '/').slice(0, 300);
  let token = null, busy = false, opened = false, state = { askConsent: false, offerNurture: false, bookingUrl: null, consentText: '', closed: false, mock: false };

  const el = (tag, style, text) => { const n = document.createElement(tag); if (style) Object.assign(n.style, style); if (text !== undefined) n.textContent = text; return n; };
  const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '8px 10px', fontSize: '14px', fontFamily: 'inherit', color: INK, background: '#fff' };
  const btnStyle = { background: NAVY, color: '#fff', border: '0', borderRadius: '6px', padding: '8px 14px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' };

  const launcher = el('button', { position: 'fixed', right: '16px', bottom: '16px', zIndex: '60', background: NAVY, color: '#fff', border: '0', borderRadius: '999px', padding: '12px 18px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,27,45,0.2)', fontFamily: 'Inter, Arial, sans-serif' }, 'Ask a question');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Ask PaceMakers a question');

  const panel = el('section', preview
    ? { width: '100%', maxWidth: '420px', height: '560px', display: 'flex', flexDirection: 'column', border: '1px solid #E5E7EB', borderRadius: '10px', background: '#fff', fontFamily: 'Inter, Arial, sans-serif', color: INK }
    : { position: 'fixed', right: '16px', bottom: '16px', zIndex: '60', width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 32px))', display: 'none', flexDirection: 'column', border: '1px solid #E5E7EB', borderRadius: '10px', background: '#fff', boxShadow: '0 12px 32px rgba(15,27,45,0.18)', fontFamily: 'Inter, Arial, sans-serif', color: INK });
  panel.setAttribute('aria-label', 'PaceMakers assistant');
  const head = el('header', { background: NAVY, color: '#fff', padding: '12px 14px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
  const titles = el('div');
  titles.appendChild(el('div', { fontWeight: '600', fontSize: '14px' }, 'PaceMakers'));
  const sub = el('div', { fontSize: '12px', opacity: '0.85' }, 'An assistant. Ahmad Din reads every conversation.');
  titles.appendChild(sub);
  head.appendChild(titles);
  if (!preview) {
    const close = el('button', { background: 'transparent', color: '#fff', border: '0', fontSize: '20px', cursor: 'pointer', lineHeight: '1' }, 'x');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close the assistant');
    close.onclick = () => { panel.style.display = 'none'; launcher.style.display = 'block'; };
    head.appendChild(close);
  }
  const list = el('div', { flex: '1', overflowY: 'auto', padding: '14px', background: CREAM, display: 'flex', flexDirection: 'column', gap: '10px' });
  list.setAttribute('aria-live', 'polite');
  const form = el('form', { display: 'flex', gap: '8px', padding: '10px', borderTop: '1px solid #E5E7EB' });
  const box = el('input', inputStyle);
  box.maxLength = 1000;
  box.placeholder = 'Type your question';
  box.setAttribute('aria-label', 'Your message');
  const send = el('button', btnStyle, 'Send');
  send.type = 'submit';
  form.append(box, send);
  const leave = el('button', { background: 'transparent', border: '0', borderTop: '1px solid #E5E7EB', color: NAVY, fontSize: '13px', padding: '8px', cursor: 'pointer', display: 'none' }, 'Leave your details for Ahmad');
  leave.type = 'button';
  panel.append(head, list, form, leave);

  const scroll = () => { list.scrollTop = list.scrollHeight; };
  const bubble = (role, text) => {
    const b = el('div', { alignSelf: role === 'visitor' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: role === 'visitor' ? NAVY : '#fff', color: role === 'visitor' ? '#fff' : INK, border: role === 'visitor' ? '0' : '1px solid #E8EEF5', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }, text);
    list.appendChild(b); scroll();
  };
  const note = (text, colour) => { const n = el('div', { fontSize: '13px', color: colour || MUTED }, text); list.appendChild(n); scroll(); return n; };

  let consentForm = null;
  const showConsent = () => {
    if (consentForm || !state.consentText) return;
    consentForm = el('form', { background: '#fff', border: '1px solid #E8EEF5', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' });
    consentForm.appendChild(el('div', { fontSize: '13px', fontWeight: '600' }, 'Leave your details for Ahmad'));
    const field = (ph, type, required) => { const i = el('input', inputStyle); i.placeholder = ph; i.type = type; i.required = required; i.setAttribute('aria-label', ph); consentForm.appendChild(i); return i; };
    const name = field('Name', 'text', true), email = field('Email', 'email', true), phone = field('Phone (optional)', 'text', false), company = field('Company (optional)', 'text', false);
    let nurture = null;
    if (state.offerNurture) {
      const l = el('label', { fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'flex-start' });
      nurture = el('input'); nurture.type = 'checkbox';
      l.append(nurture, el('span', null, 'Send me occasional insights from PaceMakers. I can unsubscribe at any time.'));
      consentForm.appendChild(l);
    }
    const agreeLabel = el('label', { fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'flex-start' });
    const agree = el('input'); agree.type = 'checkbox'; agree.required = true;
    agreeLabel.append(agree, el('span', null, state.consentText));
    consentForm.appendChild(agreeLabel);
    const row = el('div', { display: 'flex', gap: '8px' });
    const ok = el('button', btnStyle, 'Send details'); ok.type = 'submit';
    const later = el('button', { background: 'transparent', border: '0', color: MUTED, fontSize: '13px', cursor: 'pointer' }, 'Not now'); later.type = 'button';
    later.onclick = () => { consentForm.remove(); consentForm = null; };
    row.append(ok, later);
    consentForm.appendChild(row);
    consentForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!agree.checked) return;
      const done = await post({ consent: { given: true, name: name.value, email: email.value, phone: phone.value || undefined, company: company.value || undefined, nurture: nurture ? nurture.checked : false } });
      if (done && consentForm) { consentForm.remove(); consentForm = null; }
    };
    list.appendChild(consentForm); scroll();
  };

  let booking = null;
  const render = () => {
    sub.textContent = state.mock ? 'Preview: sample replies, not written by Claude' : 'An assistant. Ahmad Din reads every conversation.';
    if (state.bookingUrl && !booking) {
      booking = el('a', { alignSelf: 'flex-start', background: NAVY, color: '#fff', padding: '8px 14px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' }, 'Choose a time with Ahmad');
      booking.href = state.bookingUrl; booking.target = '_blank'; booking.rel = 'noopener noreferrer';
      list.appendChild(booking); scroll();
    }
    if (state.askConsent) showConsent();
    form.style.display = state.closed ? 'none' : 'flex';
    leave.style.display = token && !state.closed && !consentForm ? 'block' : 'none';
  };

  async function post(body) {
    if (busy) return false;
    busy = true; send.disabled = true;
    const writing = note('Writing');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(Object.assign({ token, page: path() }, body)) });
      const data = await res.json().catch(() => ({}));
      writing.remove();
      if (!res.ok) { note(data.error || 'The assistant is not available just now.', '#B91C1C'); return false; }
      token = data.token;
      state = { askConsent: data.askConsent, offerNurture: data.offerNurture, bookingUrl: data.bookingUrl, consentText: data.consentText, closed: data.closed, mock: data.mock };
      if (data.reply) bubble('assistant', data.reply);
      render();
      return true;
    } catch (err) {
      writing.remove(); note('Something went wrong. Please try again.', '#B91C1C'); return false;
    } finally { busy = false; send.disabled = false; }
  }

  form.onsubmit = (e) => { e.preventDefault(); const msg = box.value.trim(); if (!msg || busy) return; bubble('visitor', msg); box.value = ''; post({ message: msg }); };
  leave.onclick = () => { showConsent(); render(); };

  const open = async () => {
    panel.style.display = 'flex'; launcher.style.display = 'none';
    if (opened) return;
    opened = true;
    try {
      const r = await fetch(endpoint + '?path=' + encodeURIComponent(path()), { credentials: 'same-origin' });
      const d = r.ok ? await r.json() : null;
      if (d && d.opening) bubble('assistant', d.opening);
    } catch (err) { /* the visitor can still type */ }
    box.focus();
  };
  launcher.onclick = open;

  if (preview) { mount.appendChild(panel); open(); }
  else { document.body.append(launcher, panel); }
})();`;
}
