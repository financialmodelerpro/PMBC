/**
 * The website chat widget as a plain script (Unit 4.2, 2026-09-23; opening
 * behaviour 2026-09-23).
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
 *
 * Opening by itself (settings from migration 095, carried on the script tag):
 * once per browser session, after `data-delay` seconds or when the visitor
 * scrolls past `data-scroll` per cent of the page, whichever comes first.
 * Never twice in a session (sessionStorage), and never again once the visitor
 * has closed it (localStorage). On a phone it never opens the full panel by
 * itself: it shows a small note above the button with the opening line, which
 * one tap dismisses. The phone panel has a large close button, and Escape
 * closes it anywhere. When storage is blocked, it does not open by itself.
 */

export const WIDGET_STORAGE = { autoOpened: 'pmbc-chat-auto-opened', closed: 'pmbc-chat-closed' } as const;

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
  const autoOpen = me.dataset.autoOpen === '1';
  const delaySeconds = Math.min(300, Math.max(5, Number(me.dataset.delay) || 20));
  const scrollPercent = Math.min(100, Math.max(10, Number(me.dataset.scroll) || 50));
  const KEY_AUTO = '${WIDGET_STORAGE.autoOpened}', KEY_CLOSED = '${WIDGET_STORAGE.closed}';
  const store = (kind) => { try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch (err) { return null; } };
  const flag = (kind, key) => { try { const s = store(kind); return s ? s.getItem(key) === '1' : null; } catch (err) { return null; } };
  const setFlag = (kind, key) => { try { const s = store(kind); if (s) s.setItem(key, '1'); } catch (err) { /* blocked storage: nothing to remember */ } };
  const phone = () => { try { return window.matchMedia('(max-width: 640px)').matches; } catch (err) { return window.innerWidth <= 640; } };
  let token = null, busy = false, opened = false, state = { askConsent: false, offerNurture: false, bookingUrl: null, consentText: '', closed: false, mock: false };

  const el = (tag, style, text) => { const n = document.createElement(tag); if (style) Object.assign(n.style, style); if (text !== undefined) n.textContent = text; return n; };
  const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '8px 10px', fontSize: '16px', fontFamily: 'inherit', color: INK, background: '#fff' };
  const btnStyle = { background: NAVY, color: '#fff', border: '0', borderRadius: '6px', padding: '8px 14px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' };
  const small = phone();

  const launcher = el('button', { position: 'fixed', right: small ? '12px' : '16px', bottom: small ? '12px' : '16px', zIndex: '60', background: NAVY, color: '#fff', border: '0', borderRadius: '999px', padding: small ? '10px 16px' : '12px 18px', minHeight: '44px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,27,45,0.2)', fontFamily: 'Inter, Arial, sans-serif' }, small ? 'Ask' : 'Ask a question');
  launcher.type = 'button';
  launcher.dataset.pmbcChat = 'launcher';
  launcher.setAttribute('aria-label', 'Ask PaceMakers a question');

  const panel = el('section', preview
    ? { width: '100%', maxWidth: '420px', height: '560px', display: 'flex', flexDirection: 'column', border: '1px solid #E5E7EB', borderRadius: '10px', background: '#fff', fontFamily: 'Inter, Arial, sans-serif', color: INK }
    : small
      ? { position: 'fixed', left: '8px', right: '8px', bottom: '8px', zIndex: '60', height: 'min(70vh, 520px)', display: 'none', flexDirection: 'column', border: '1px solid #E5E7EB', borderRadius: '10px', background: '#fff', boxShadow: '0 12px 32px rgba(15,27,45,0.18)', fontFamily: 'Inter, Arial, sans-serif', color: INK }
      : { position: 'fixed', right: '16px', bottom: '16px', zIndex: '60', width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 32px))', display: 'none', flexDirection: 'column', border: '1px solid #E5E7EB', borderRadius: '10px', background: '#fff', boxShadow: '0 12px 32px rgba(15,27,45,0.18)', fontFamily: 'Inter, Arial, sans-serif', color: INK });
  panel.dataset.pmbcChat = 'panel';
  panel.setAttribute('aria-label', 'PaceMakers assistant');
  const head = el('header', { background: NAVY, color: '#fff', padding: '8px 8px 8px 14px', borderRadius: '10px 10px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
  const titles = el('div');
  titles.appendChild(el('div', { fontWeight: '600', fontSize: '14px' }, 'PaceMakers'));
  const sub = el('div', { fontSize: '12px', opacity: '0.85' }, 'An assistant. Ahmad Din reads every conversation.');
  titles.appendChild(sub);
  head.appendChild(titles);

  let timer = null, teaser = null;
  const stopAuto = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    window.removeEventListener('scroll', onScroll);
  };
  const close = () => {
    panel.style.display = 'none'; launcher.style.display = 'block';
    if (teaser) { teaser.remove(); teaser = null; }
    // Closed once, never opened by itself again.
    setFlag('local', KEY_CLOSED); setFlag('session', KEY_AUTO); stopAuto();
  };
  if (!preview) {
    const x = el('button', { background: 'transparent', color: '#fff', border: '0', fontSize: '22px', cursor: 'pointer', lineHeight: '1', width: '44px', height: '44px', borderRadius: '6px' }, '×');
    x.type = 'button';
    x.dataset.pmbcChat = 'close';
    x.setAttribute('aria-label', 'Close the assistant');
    x.onclick = close;
    head.appendChild(x);
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
    if (role === 'assistant') b.dataset.pmbcChat = 'assistant';
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

  let openingPromise = null;
  const opening = () => {
    if (!openingPromise) {
      openingPromise = fetch(endpoint + '?path=' + encodeURIComponent(path()), { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d && d.opening) || null)
        .catch(() => null);
    }
    return openingPromise;
  };

  const open = async (how) => {
    panel.style.display = 'flex'; launcher.style.display = 'none';
    if (teaser) { teaser.remove(); teaser = null; }
    if (how !== 'auto') { setFlag('session', KEY_AUTO); stopAuto(); }
    if (opened) return;
    opened = true;
    const line = await opening();
    if (line) bubble('assistant', line);
    // Focusing would pop the keyboard up on a phone, or pull focus from what the visitor was doing.
    if (how !== 'auto' && !small) box.focus();
  };
  launcher.onclick = () => open('click');

  // A small note above the button on a phone: it covers little, and one tap dismisses it.
  const showTeaser = async () => {
    const line = await opening();
    if (!line || opened || teaser) return;
    teaser = el('div', { position: 'fixed', right: '12px', bottom: '64px', zIndex: '60', width: 'min(300px, calc(100vw - 24px))', boxSizing: 'border-box', background: '#fff', color: INK, border: '1px solid #E5E7EB', borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,27,45,0.18)', padding: '10px 4px 10px 12px', display: 'flex', gap: '4px', alignItems: 'flex-start', fontFamily: 'Inter, Arial, sans-serif' });
    teaser.dataset.pmbcChat = 'teaser';
    const text = el('button', { flex: '1', textAlign: 'left', background: 'transparent', border: '0', padding: '0', fontSize: '14px', lineHeight: '1.4', color: INK, cursor: 'pointer', fontFamily: 'inherit' }, line);
    text.type = 'button';
    text.setAttribute('aria-label', 'Open the assistant: ' + line);
    text.onclick = () => open('click');
    const x = el('button', { background: 'transparent', border: '0', color: MUTED, fontSize: '20px', lineHeight: '1', width: '44px', height: '44px', flex: '0 0 44px', cursor: 'pointer' }, '×');
    x.type = 'button';
    x.dataset.pmbcChat = 'teaser-close';
    x.setAttribute('aria-label', 'Dismiss');
    x.onclick = close;
    teaser.append(text, x);
    document.body.appendChild(teaser);
  };

  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    stopAuto();
    if (opened || panel.style.display === 'flex') return;
    setFlag('session', KEY_AUTO);
    if (phone()) showTeaser(); else open('auto');
  };
  function onScroll() {
    const doc = document.documentElement;
    const room = doc.scrollHeight - window.innerHeight;
    if (room > 0 && window.scrollY / room >= scrollPercent / 100) fire();
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (panel.style.display === 'flex' || teaser)) close(); });

  if (preview) { mount.appendChild(panel); open('click'); }
  else {
    document.body.append(launcher, panel);
    // On a phone, room at the foot of the page so the button never sits over the last lines or the footer links.
    if (small) { const pad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0; document.body.style.paddingBottom = (pad + 68) + 'px'; }
    // Only when storage answers: a blocked store cannot remember the visitor closed it, so it never opens by itself.
    const alreadyAuto = flag('session', KEY_AUTO), closedBefore = flag('local', KEY_CLOSED);
    if (autoOpen && alreadyAuto === false && closedBefore === false) {
      timer = setTimeout(fire, delaySeconds * 1000);
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }
})();`;
}
