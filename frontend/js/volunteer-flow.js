import { applyForEvent, getMe } from './db.js';

let activeDialog = null;

function addDialogStyles() {
  if (document.getElementById('serveo-volunteer-dialog-styles')) return;

  const style = document.createElement('style');
  style.id = 'serveo-volunteer-dialog-styles';
  style.textContent = `
    .volunteer-dialog-backdrop { position: fixed; inset: 0; z-index: 10020; display: grid; place-items: center; padding: 18px; background: rgba(3,7,12,.76); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); animation: volunteer-backdrop-in .16s ease-out; }
    .volunteer-dialog { width: min(100%, 560px); max-height: min(90vh, 760px); overflow: auto; border: 1px solid rgba(0,212,170,.24); border-radius: 22px; color: var(--text-primary,#f4f6f9); background: linear-gradient(155deg,rgba(24,32,44,.99),rgba(11,16,25,.99)); box-shadow: 0 24px 90px rgba(0,0,0,.58), 0 0 34px rgba(0,212,170,.08); }
    .volunteer-dialog-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; padding:22px 24px 14px; }
    .volunteer-dialog-eyebrow { margin:0 0 6px; color:var(--accent-primary,#00d4aa); font:600 .68rem var(--font-mono,monospace); letter-spacing:.12em; text-transform:uppercase; }
    .volunteer-dialog-head h2 { margin:0; font-size:1.45rem; }
    .volunteer-dialog-close { flex:0 0 auto; width:36px; height:36px; border:1px solid var(--border-color-strong,rgba(255,255,255,.16)); border-radius:50%; color:var(--text-secondary,#99a3b3); background:rgba(255,255,255,.04); font-size:1.35rem; cursor:pointer; }
    .volunteer-event-summary { margin:0 24px 18px; padding:16px; border:1px solid rgba(0,212,170,.15); border-radius:15px; background:linear-gradient(130deg,rgba(0,212,170,.08),rgba(6,182,212,.035)); }
    .volunteer-event-summary h3 { margin:0 0 10px; font-size:1rem; line-height:1.35; }
    .volunteer-event-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px 14px; }
    .volunteer-event-meta div { min-width:0; color:var(--text-secondary,#99a3b3); font-size:.77rem; overflow-wrap:anywhere; }
    .volunteer-event-meta strong { display:block; margin-bottom:2px; color:var(--text-tertiary,#5b6472); font:500 .62rem var(--font-mono,monospace); letter-spacing:.07em; text-transform:uppercase; }
    .volunteer-event-description { margin:12px 0 0; color:var(--text-secondary,#99a3b3); font-size:.8rem; line-height:1.55; }
    .volunteer-form { display:grid; gap:13px; padding:0 24px 23px; }
    .volunteer-form label { display:grid; gap:6px; color:var(--text-secondary,#99a3b3); font-size:.76rem; font-weight:600; }
    .volunteer-form input[type=text],.volunteer-form input[type=tel],.volunteer-form input[type=email] { width:100%; min-height:43px; padding:10px 12px; border:1px solid var(--border-color-strong,rgba(255,255,255,.16)); border-radius:10px; outline:none; color:var(--text-primary,#f4f6f9); background:rgba(4,8,14,.55); font:400 .87rem var(--font-body,Arial,sans-serif); }
    .volunteer-form input:focus { border-color:var(--accent-primary,#00d4aa); box-shadow:0 0 0 3px rgba(0,212,170,.1); }
    .volunteer-verification-note { margin:-3px 0 0; color:var(--text-tertiary,#5b6472); font-size:.72rem; line-height:1.5; }
    .volunteer-consent { display:flex !important; grid-template-columns:auto 1fr; align-items:flex-start; gap:9px !important; padding:11px 12px; border:1px solid var(--border-color,rgba(255,255,255,.08)); border-radius:10px; background:rgba(255,255,255,.025); line-height:1.45; }
    .volunteer-consent input { margin:2px 0 0; accent-color:var(--accent-primary,#00d4aa); }
    .volunteer-form-message { min-height:18px; color:#ffaaaa; font-size:.77rem; }
    .volunteer-form-actions { display:flex; justify-content:flex-end; gap:10px; }
    .volunteer-form-actions button { min-height:42px; padding:0 16px; border-radius:10px; font:600 .82rem var(--font-body,Arial,sans-serif); cursor:pointer; }
    .volunteer-cancel { border:1px solid var(--border-color-strong,rgba(255,255,255,.16)); color:var(--text-secondary,#99a3b3); background:rgba(255,255,255,.04); }
    .volunteer-submit { border:0; color:#04140f; background:var(--accent-gradient,linear-gradient(135deg,#00d4aa,#06b6d4)); box-shadow:0 5px 20px rgba(0,212,170,.16); }
    .volunteer-submit:disabled { opacity:.58; cursor:wait; }
    .volunteer-success { padding:12px 24px 26px; text-align:center; }
    .volunteer-success-icon { display:grid; place-items:center; width:50px; height:50px; margin:0 auto 12px; border-radius:50%; color:#04140f; background:var(--accent-gradient,linear-gradient(135deg,#00d4aa,#06b6d4)); font-size:1.5rem; }
    .volunteer-success h3 { margin:0 0 7px; }
    .volunteer-success p { color:var(--text-secondary,#99a3b3); font-size:.84rem; line-height:1.55; }
    @keyframes volunteer-backdrop-in { from { opacity:0; } to { opacity:1; } }
    @media(max-width:520px) { .volunteer-dialog-backdrop { padding:10px; } .volunteer-dialog-head { padding:19px 18px 13px; } .volunteer-event-summary { margin:0 18px 16px; } .volunteer-form { padding:0 18px 19px; } .volunteer-event-meta { grid-template-columns:1fr 1fr; } }
    @media(prefers-reduced-motion:reduce) { .volunteer-dialog-backdrop { animation:none; } }
  `;
  document.head.appendChild(style);
}

function text(value, fallback = 'Not provided') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function dateText(value) {
  if (!value) return 'To be announced';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function plainText(value) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(value ?? '');
  return decoder.value;
}

function saveJoinedEvent(event, { sample = false } = {}) {
  try {
    const eventId = String(event.id);
    const key = 'serveo_joined';
    const joined = JSON.parse(localStorage.getItem(key) || '[]').map(String);
    if (!joined.includes(eventId)) joined.push(eventId);
    localStorage.setItem(key, JSON.stringify(joined));

    const activityKey = 'serveo_volunteer_activity';
    const records = JSON.parse(localStorage.getItem(activityKey) || '[]');
    const existing = Array.isArray(records) ? records.find(record => String(record.id) === eventId && record.kind === 'volunteer') : null;
    const record = {
      id: eventId,
      kind: 'volunteer',
      title: plainText(event.title || 'Community event'),
      category: plainText(event.category || 'other'),
      organizer: plainText(event.organizer || 'Community Organizer'),
      date: String(event.date || ''),
      city: plainText(event.city || ''),
      address: plainText(event.address || ''),
      activityStatus: 'Registered',
      sample: sample || Boolean(existing?.sample),
      joinedAt: existing?.joinedAt || new Date().toISOString(),
    };
    const updated = Array.isArray(records) ? records.filter(item => !(String(item.id) === eventId && item.kind === 'volunteer')) : [];
    updated.unshift(record);
    localStorage.setItem(activityKey, JSON.stringify(updated.slice(0, 50)));
    window.dispatchEvent(new CustomEvent('serveo:activity-updated'));
  } catch { }
}

function setDetail(summary, selector, value) {
  const target = summary.querySelector(selector);
  if (target) target.textContent = value;
}

export async function openVolunteerForm(event, { onSuccess } = {}) {
  if (!event) return;
  if (activeDialog) return;
  addDialogStyles();

  const previousOverflow = document.body.style.overflow;
  const previouslyFocused = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'volunteer-dialog-backdrop';
  backdrop.innerHTML = `
    <section class="volunteer-dialog" role="dialog" aria-modal="true" aria-labelledby="volunteer-dialog-title" tabindex="-1">
      <header class="volunteer-dialog-head">
        <div><p class="volunteer-dialog-eyebrow">Volunteer registration</p><h2 id="volunteer-dialog-title">Help at this event</h2></div>
        <button class="volunteer-dialog-close" type="button" aria-label="Close">&times;</button>
      </header>
      <section class="volunteer-event-summary" aria-label="Event details">
        <h3 data-event-title></h3>
        <div class="volunteer-event-meta">
          <div><strong>Category</strong><span data-event-category></span></div>
          <div><strong>Organizer</strong><span data-event-organizer></span></div>
          <div><strong>Date and time</strong><span data-event-date></span></div>
          <div><strong>Location</strong><span data-event-location></span></div>
        </div>
        <p class="volunteer-event-description" data-event-description hidden></p>
      </section>
      <form class="volunteer-form">
        <label>Full name<input name="applicantName" type="text" autocomplete="name" maxlength="100" required placeholder="Your name as the organizer should know it"></label>
        <label>Mobile number<input name="applicantPhone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+91 98765 43210"></label>
        <label>Email address<input name="applicantEmail" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"></label>
        <p class="volunteer-verification-note">The organizer can use these contact details to confirm your identity and coordinate your volunteer role.</p>
        <label class="volunteer-consent"><input name="contactConsent" type="checkbox" required><span>I agree to share these details with this event’s organizer for volunteer verification and coordination.</span></label>
        <p class="volunteer-form-message" role="status" aria-live="polite"></p>
        <div class="volunteer-form-actions"><button class="volunteer-cancel" type="button">Cancel</button><button class="volunteer-submit" type="submit">Submit volunteer request</button></div>
      </form>
    </section>`;

  const dialog = backdrop.querySelector('.volunteer-dialog');
  const summary = backdrop.querySelector('.volunteer-event-summary');
  const title = text(event.title, 'Community event');
  const category = text(event.category, 'Community support').replace(/[_-]+/g, ' ');
  const location = [event.address, event.city].filter(Boolean).map(String).join(', ');
  const dateAndTime = [dateText(event.date), event.startTime, event.endTime ? `– ${event.endTime}` : '']
    .filter((part, index) => index === 0 || part).join(' ');

  setDetail(summary, '[data-event-title]', title);
  setDetail(summary, '[data-event-category]', category);
  setDetail(summary, '[data-event-organizer]', text(event.organizer, 'Community Organizer'));
  setDetail(summary, '[data-event-date]', dateAndTime);
  setDetail(summary, '[data-event-location]', location || 'Location to be confirmed');
  const description = summary.querySelector('[data-event-description]');
  if (event.description) {
    description.textContent = String(event.description);
    description.hidden = false;
  }

  const close = () => {
    if (activeDialog !== backdrop) return;
    backdrop.remove();
    activeDialog = null;
    document.body.style.overflow = previousOverflow;
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
  };

  backdrop.querySelector('.volunteer-dialog-close').addEventListener('click', close);
  backdrop.querySelector('.volunteer-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  const onKeyDown = (e) => {
    if (e.key === 'Escape') close();
  };
  backdrop.addEventListener('keydown', onKeyDown);

  const form = backdrop.querySelector('.volunteer-form');
  const message = backdrop.querySelector('.volunteer-form-message');
  const submit = backdrop.querySelector('.volunteer-submit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const application = {
      applicantName: String(values.get('applicantName') || '').trim(),
      applicantPhone: String(values.get('applicantPhone') || '').trim(),
      applicantEmail: String(values.get('applicantEmail') || '').trim()
    };

    submit.disabled = true;
    submit.textContent = 'Submitting…';
    message.textContent = '';
    try {
      let result;
      if (event.isSample || String(event.id || '').startsWith('demo-')) {
        result = { success: true, demo: true, volunteersJoined: Number(event.volunteersJoined || 0) + 1 };
      } else {
        result = await applyForEvent(event.id, application);
      }
      saveJoinedEvent(event, { sample: Boolean(result.demo) });
      form.remove();
      const success = document.createElement('div');
      success.className = 'volunteer-success';
      success.innerHTML = '<div class="volunteer-success-icon" aria-hidden="true">✓</div><h3>Request received</h3><p></p><div class="volunteer-form-actions" style="justify-content:center;margin-top:18px"><button class="volunteer-submit" type="button">Done</button></div>';
      success.querySelector('p').textContent = result.demo
        ? 'This is a sample nearby alert. Your details were not sent to an organizer.'
        : 'The organizer can contact you using the details you provided to verify and coordinate your volunteering.';
      success.querySelector('button').addEventListener('click', close);
      dialog.appendChild(success);
      if (typeof onSuccess === 'function') onSuccess(result);
    } catch (err) {
      message.textContent = err.message || 'Could not submit your request. Please try again.';
      submit.disabled = false;
      submit.textContent = 'Submit volunteer request';
    }
  });

  activeDialog = backdrop;
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  const nameInput = form.querySelector('[name="applicantName"]');
  nameInput.focus();
  try {
    const user = await getMe();
    if (activeDialog !== backdrop || !user) return;
    if (!nameInput.value && user.name) nameInput.value = user.name;
    const phoneInput = form.querySelector('[name="applicantPhone"]');
    const emailInput = form.querySelector('[name="applicantEmail"]');
    if (!phoneInput.value && user.phone) phoneInput.value = user.phone;
    if (!emailInput.value && user.email) emailInput.value = user.email;
  } catch { }
}
