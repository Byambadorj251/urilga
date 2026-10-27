const app = document.querySelector('#app');
const timeZone = 'Asia/Ulaanbaatar';
const activities = [
  { id: 'coffee', emoji: '☕', label: 'Кофе ууж ярилцах' },
  { id: 'movie', emoji: '🎬', label: 'Кино үзэх' },
  { id: 'meal', emoji: '🍜', label: 'Хоол идэх' },
  { id: 'walk', emoji: '🌳', label: 'Хамт алхах' },
  { id: 'game', emoji: '🎮', label: 'Тоглоом тоглох' },
  { id: 'surprise', emoji: '🎁', label: 'Чи намайг гайхшруул' },
  { id: 'custom', emoji: '✍️', label: 'Өөр санал' },
];
const emptyForm = () => ({ date: '', time: '', activities: [], customActivity: '', place: '', note: '' });
let state = {
  screen: 'gift',
  answer: null,
  form: emptyForm(),
  error: '',
  sending: false,
  sentAt: '',
  request: null,
  savedPayload: null,
};

try {
  const saved = JSON.parse(sessionStorage.getItem('bolzoony-urilga-state') || 'null');
  if (saved && ['gift', 'invite', 'rethink', 'date', 'activities', 'confirm', 'decline', 'success'].includes(saved.screen)) {
    state = { ...state, ...saved, sending: false, error: '' };
  }
} catch { /* Storage is optional; the invitation still works without it. */ }

function persist() {
  try {
    sessionStorage.setItem('bolzoony-urilga-state', JSON.stringify({
      screen: state.screen, answer: state.answer, form: state.form, sentAt: state.sentAt,
      request: state.request, savedPayload: state.savedPayload,
    }));
  } catch { /* Storage is optional; do not block the form. */ }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

const cat = () => `<figure class="cat-photo-wrap">
  <img class="cat-photo" src="https://media1.giphy.com/media/euW6JDwrMn0BqyNC8t/giphy.gif" alt="Зүрх илгээж буй өхөөрдөм цагаан муурын хөдөлгөөнт sticker" loading="lazy" decoding="async" referrerpolicy="no-referrer">
  <figcaption class="cat-credit"><a href="https://giphy.com/explore/love-you-cat-stickers" target="_blank" rel="noopener noreferrer">Sticker: GIPHY</a></figcaption>
</figure>`;

function giftIllustration() {
  return `<div class="gift-art" role="img" aria-label="Ягаан туузтай бэлгийн хайрцаг">
    <span class="gift-spark a">✦</span><span class="gift-spark b">✧</span><span class="gift-spark c">✦</span>
    <div class="gift-box"></div><div class="gift-ribbon"></div><div class="gift-lid"></div><div class="gift-bow">♡</div>
  </div>`;
}

function panel(content, extra = '') {
  return `<section class="panel ${extra}">${content}</section>`;
}

function stepTop(number, title) {
  const progress = number === 1 ? 33 : number === 2 ? 66 : 100;
  return `<div class="step-top">
    <div class="progress-meta"><span>Болзооны төлөвлөгөө</span><span>${number} / 3</span></div>
    <div class="progress-rail" aria-label="Явц ${progress}%"><div class="progress-fill" style="width:${progress}%"></div></div>
  </div>
  <div class="step-body">${title}</div>`;
}

function renderGift() {
  return panel(`<div class="split">
    <div class="copy-side">
      <span class="eyebrow">Зөвхөн чамд</span>
      <h1>Чамд нэг жижигхэн бэлэг байна 🎁</h1>
      <p class="lede">Жаахан зүрх догдлуулах зүйл бэлдчихлээ. Хамтдаа нээгээд үзэх үү?</p>
      <button class="btn btn-primary" data-action="open-gift">Нээгээд үз <span aria-hidden="true">💝</span></button>
    </div>
    <div class="art-side"><span class="float-heart one">♡</span><span class="float-heart two">✦</span>${giftIllustration()}</div>
  </div>`);
}

function renderInvite() {
  return panel(`<div class="split">
    <div class="copy-side">
      <span class="eyebrow">Надад нэг асуулт байна</span>
      <h1>Надтай болзоонд явах уу? 🥺💕</h1>
      <p class="lede">Хариултаа сонгоорой. Тийм гэвэл хамтдаа хамгийн гоё төлөвлөгөөгөө гаргая.</p>
      <div class="button-row">
        <button class="btn btn-yes" data-action="yes">YES <span aria-hidden="true">💖</span></button>
        <button class="btn btn-no" data-action="no">NO <span aria-hidden="true">🙈</span></button>
      </div>
    </div>
    <div class="art-side"><span class="float-heart one">♡</span><span class="float-heart two">♡</span><span class="float-heart three">✦</span><div class="art-blob"></div>${cat()}</div>
  </div>`);
}

function renderRethink() {
  return panel(`<div class="split">
    <div class="copy-side">
      <span class="eyebrow">Жаахан л бодоорой</span>
      <h2>Дахиад нэг бодоод үзэх үү? 🥺</h2>
      <p class="lede">Хэрвээ боломжтой бол чамтай өхөөрдөм болзоо төлөвлөхөд би их баярлана шүү.</p>
      <div class="button-row">
        <button class="btn btn-yes" data-action="yes">За тэгье <span aria-hidden="true">💗</span></button>
        <button class="btn btn-no" data-action="decline">Энэ удаа амжихгүй ээ</button>
      </div>
    </div>
    <div class="art-side"><span class="float-heart one">♡</span><div class="art-blob"></div>${cat()}</div>
  </div>`);
}

function renderDecline() {
  const busy = state.sending;
  return panel(`<div class="split decline-panel">
    <div class="copy-side">
      <span class="eyebrow">Хариуг чинь авлаа</span>
      <h2>Зүгээр ээ, дараа боломжтой үедээ 💌</h2>
      <p class="lede">Үнэнээ хэлсэнд баярлалаа. Чамд гоё өдөр хүсье.</p>
      ${state.error ? `<div class="notice error" role="alert"><span>♡</span><span>${escapeHtml(state.error)}</span></div>` : ''}
      <button class="btn btn-primary" data-action="retry" ${busy ? 'disabled' : ''}>${busy ? 'Илгээж байна…' : state.error ? 'Дахин оролдох' : 'Хариуг илгээж байна…'} <span aria-hidden="true">${busy ? '⏳' : '💌'}</span></button>
      <div class="decline-status" aria-live="polite">${busy ? 'Хариуг чинь аюулгүй илгээж байна…' : state.error ? 'Хариу энэ төхөөрөмж дээр хадгалагдсан.' : 'Зөвхөн сонгосон хариуг илгээнэ.'}</div>
    </div>
    <div class="art-side"><span class="float-heart one">♡</span><span class="float-heart two">✦</span><div class="art-blob"></div>${cat()}</div>
  </div>`, 'decline-panel');
}

function zonedParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function minDate() {
  const part = zonedParts();
  return `${part.year}-${part.month}-${part.day}`;
}

function minTime() {
  const part = zonedParts();
  return `${part.hour}:${part.minute}`;
}

function zonedTimestamp(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallClock);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1
      || check.getUTCDate() !== day || hour > 23 || minute > 59) return NaN;
  let timestamp = wallClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const localAsUtc = Date.UTC(
      Number(part.year), Number(part.month) - 1, Number(part.day),
      Number(part.hour), Number(part.minute), Number(part.second),
    );
    timestamp = wallClock - (localAsUtc - timestamp);
  }
  return timestamp;
}

function renderDate() {
  const f = state.form;
  const today = minDate();
  const timeMin = f.date === today ? minTime() : '00:00';
  return panel(stepTop(1, `<div class="step-heading">
      <span class="eyebrow">Хамгийн түрүүнд</span><h2>Хэзээ уулзах вэ? 📅</h2>
      <p class="lede">Өөрт чинь тухтай өдөр, цагаа сонгоорой. Бүгд Улаанбаатарын цагаар харагдана.</p>
    </div>
    <div class="notice"><span>✨</span><span>Яая! Хоёулаа болзоогоо төлөвлөе 🥰</span></div>
    ${state.error ? `<div class="notice error" role="alert"><span>♡</span><span>${escapeHtml(state.error)}</span></div>` : ''}
    <div class="form-grid">
      <div class="field"><label for="date">Өдөр</label><input class="input" id="date" name="date" type="date" min="${today}" value="${escapeHtml(f.date)}" required></div>
      <div class="field"><label for="time">Цаг <span class="field-hint">(Улаанбаатар)</span></label><input class="input" id="time" name="time" type="time" min="${timeMin}" value="${escapeHtml(f.time)}" required></div>
    </div>
    ${f.date && f.time ? `<div class="notice" style="margin-top:17px;margin-bottom:0"><span>♡</span><span>${escapeHtml(formatDate(f.date, f.time))}</span></div>` : ''}
    <div class="step-actions"><button class="text-button" data-action="back-invite">← Буцах</button><button class="btn btn-primary" data-action="next-date">Үргэлжлүүлэх <span aria-hidden="true">→</span></button></div>`), 'step-panel');
}

function formatDate(date, time) {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  const jsDate = new Date(zonedTimestamp(date, '12:00'));
  const weekday = new Intl.DateTimeFormat('mn-MN', { timeZone, weekday: 'long' }).format(jsDate);
  return `${year} оны ${month}-р сарын ${day}, ${weekday}, ${time} цагт`;
}

function renderActivities() {
  const f = state.form;
  const cards = activities.map((item) => `<button type="button" class="choice-card" data-action="toggle-activity" data-id="${item.id}" aria-pressed="${f.activities.includes(item.id)}">
    <span class="choice-emoji" aria-hidden="true">${item.emoji}</span><span class="choice-label">${item.label}</span><span class="choice-check" aria-hidden="true">✓</span>
  </button>`).join('');
  return panel(stepTop(2, `<div class="step-heading">
      <span class="eyebrow">Чиний сонголт</span><h2>Хоёулаа юу хийх вэ? 💭</h2>
      <p class="lede">Нэг эсвэл хэд хэдийг сонгож болно. Хамтдаа байхад л гоё доо.</p>
    </div>
    ${state.error ? `<div class="notice error" role="alert"><span>♡</span><span>${escapeHtml(state.error)}</span></div>` : ''}
    <div class="cards-grid">${cards}</div>
    ${f.activities.includes('custom') ? `<div class="custom-wrap field"><label for="customActivity">Ямар санал байна? <span class="field-hint">(заавал биш)</span></label><input class="input" id="customActivity" name="customActivity" maxlength="500" placeholder="Жишээ нь, шинэ газар хамтдаа үзэх…" value="${escapeHtml(f.customActivity)}"></div>` : ''}
    <div class="optional-divider">Хүсвэл нэмж хэлээрэй</div>
    <div class="form-grid">
      <div class="field full"><label for="place">Хаана уулзах вэ? <span class="field-hint">(заавал биш)</span></label><input class="input" id="place" name="place" maxlength="300" placeholder="Кофе шоп, парк эсвэл дүүрэг…" value="${escapeHtml(f.place)}"></div>
      <div class="field full"><label for="note">Надад хэлэх зүйл байна уу? 💌 <span class="field-hint">(заавал биш)</span></label><textarea class="textarea" id="note" name="note" maxlength="1500" placeholder="Тусгай хүсэлт, дуу эсвэл зүгээр л нэг хөөрхөн зурвас…">${escapeHtml(f.note)}</textarea></div>
    </div>
    <div class="step-actions"><button class="btn btn-soft" data-action="back-date">← Өдөр рүү</button><button class="btn btn-primary" data-action="next-activities">Үргэлжлүүлэх <span aria-hidden="true">→</span></button></div>`), 'step-panel');
}

function activityNames() {
  return state.form.activities.map((id) => {
    const item = activities.find((a) => a.id === id);
    if (!item) return '';
    return id === 'custom' ? `${item.emoji} ${item.label}: ${state.form.customActivity.trim() || 'бичээгүй'}` : `${item.emoji} ${item.label}`;
  }).filter(Boolean).join(' · ');
}

function summaryRow(label, value) {
  const empty = !value;
  return `<div class="summary-row"><dt>${label}</dt><dd class="${empty ? 'empty' : ''}">${escapeHtml(value || 'Сонгоогүй')}</dd></div>`;
}

function renderConfirm() {
  const f = state.form;
  const rows = [
    summaryRow('Хариу', 'YES 💖 — Тийм, болзоонд явна'),
    summaryRow('Өдөр, цаг', formatDate(f.date, f.time)),
    summaryRow('Хийх зүйл', activityNames()),
    summaryRow('Уулзах газар', f.place.trim()),
    summaryRow('Нэмэлт зурвас', f.note.trim()),
  ].join('');
  return panel(stepTop(3, `<div class="step-heading">
      <span class="eyebrow">Сүүлчийн удаа шалгая</span><h2>Болзооны төлөвлөгөө 💌</h2>
      <p class="lede">Илгээсний дараа энэ хөөрхөн хариу чамд хүрнэ.</p>
    </div>
    ${state.error ? `<div class="notice error" role="alert"><span>♡</span><span>${escapeHtml(state.error)}</span></div>` : ''}
    <div class="summary-card"><div class="summary-head"><span class="summary-icon">💕</span><div><strong>Хоёулангийн маань болзоо</strong><small>Хараад зөв байвал батлаарай</small></div></div><dl class="summary-list">${rows}</dl></div>
    <div class="step-actions"><button class="btn btn-soft" data-action="edit">← Засах</button><button class="btn btn-primary" data-action="send" ${state.sending ? 'disabled' : ''}>${state.sending ? 'Илгээж байна…' : 'Болзоогоо баталъя 💕'}</button></div>`), 'step-panel');
}

function renderSuccess() {
  const now = Date.now();
  const target = zonedTimestamp(state.form.date, state.form.time);
  let remaining = Number.isFinite(target) ? Math.max(0, target - now) : 0;
  const days = Math.floor(remaining / 86400000); remaining -= days * 86400000;
  const hours = Math.floor(remaining / 3600000); remaining -= hours * 3600000;
  const minutes = Math.floor(remaining / 60000); remaining -= minutes * 60000;
  const seconds = Math.floor(remaining / 1000);
  return panel(`<div class="panel-inner success-panel">
    <div class="success-art"><span class="float-heart one">♡</span>${cat()}</div>
    <span class="eyebrow">Баталгаажлаа</span>
    <h2 class="success-title">Болзоо товлогдлоо! Чамтай уулзахыг хүлээж байна 🥰</h2>
    <p class="success-copy">${escapeHtml(formatDate(state.form.date, state.form.time))}<br>Одоо догдлоод хүлээх л үлдлээ.</p>
    <div class="countdown" aria-label="Болзоо хүртэлх хугацаа">
      <div class="count-unit"><strong>${days}</strong><span>өдөр</span></div>
      <div class="count-unit"><strong>${String(hours).padStart(2, '0')}</strong><span>цаг</span></div>
      <div class="count-unit"><strong>${String(minutes).padStart(2, '0')}</strong><span>минут</span></div>
      <div class="count-unit"><strong>${String(seconds).padStart(2, '0')}</strong><span>секунд</span></div>
    </div>
    <p style="margin:15px 0 0;color:#aa94a0;font-size:11px">Asia/Ulaanbaatar · ${escapeHtml(state.sentAt || '')}</p>
  </div>`);
}

function render() {
  const screens = { gift: renderGift, invite: renderInvite, rethink: renderRethink, date: renderDate, activities: renderActivities, confirm: renderConfirm, decline: renderDecline, success: renderSuccess };
  app.innerHTML = (screens[state.screen] || renderGift)();
  persist();
}

function setScreen(screen) {
  state.screen = screen;
  state.error = '';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateDate() {
  if (!state.form.date || !state.form.time) return 'Өдөр, цагаа хоёуланг нь сонгоорой.';
  const target = zonedTimestamp(state.form.date, state.form.time);
  if (!Number.isFinite(target) || target <= Date.now()) return 'Өнгөрсөн өдөр, цаг сонгох боломжгүй. Ирээдүйн цагаа сонгоорой.';
  return '';
}

function confetti() {
  const colors = ['#e990ab', '#f2c876', '#b9d6c4', '#c5addd', '#f5d9a9'];
  for (let i = 0; i < 54; i += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.borderRadius = i % 3 === 0 ? '50%' : '2px';
    piece.style.setProperty('--delay', `${Math.random() * .55}s`);
    piece.style.setProperty('--fall', `${2.4 + Math.random() * 1.7}s`);
    piece.style.setProperty('--drift', `${Math.random() * 150 - 75}px`);
    piece.style.setProperty('--spin', `${Math.random() * 900 + 360}deg`);
    document.body.append(piece);
    window.setTimeout(() => piece.remove(), 5000);
  }
}

function openGift(button) {
  if (button.disabled) return;
  button.disabled = true;
  const art = app.querySelector('.art-side');
  art?.querySelector('.gift-art')?.classList.add('is-opening');
  if (art) {
    for (let i = 0; i < 9; i += 1) {
      const heart = document.createElement('span');
      heart.className = 'gift-heart';
      heart.textContent = i % 3 === 0 ? '✦' : '♡';
      heart.style.setProperty('--heart-x', `${Math.random() * 170 - 85}px`);
      heart.style.setProperty('--heart-y', `${-75 - Math.random() * 105}px`);
      heart.style.setProperty('--heart-delay', `${Math.random() * .18}s`);
      art.append(heart);
      window.setTimeout(() => heart.remove(), 1100);
    }
  }
  window.setTimeout(() => setScreen('invite'), 880);
}

async function sendAnswer(answer) {
  if (state.sending) return;
  const payload = answer === 'yes'
    ? { answer, date: state.form.date, time: state.form.time, activities: state.form.activities, customActivity: state.form.customActivity, place: state.form.place, note: state.form.note }
    : { answer };
  const fingerprint = JSON.stringify(payload);
  if (!state.request || state.savedPayload !== fingerprint) {
    state.request = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}-${Math.random()}`;
    state.savedPayload = fingerprint;
  }
  state.sending = true;
  state.error = '';
  render();
  try {
    const response = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': state.request },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success !== true) throw new Error(result.message || 'Хариуг илгээж чадсангүй. Дахин оролдоод үзээрэй.');
    state.answer = answer;
    state.sentAt = result.receivedAt || '';
    state.sending = false;
    state.error = '';
    state.screen = answer === 'yes' ? 'success' : 'decline';
    render();
    if (answer === 'yes') confetti();
  } catch (error) {
    state.sending = false;
    state.error = error.message || 'Холболтын алдаа гарлаа. Сонголт чинь хадгалагдсан тул дахин илгээгээрэй.';
    render();
  }
}

app.addEventListener('input', (event) => {
  const { name, value } = event.target;
  if (name in state.form) {
    state.form[name] = value;
    persist();
  }
});

app.addEventListener('change', (event) => {
  const { name, value } = event.target;
  if (name === 'date' || name === 'time') {
    state.form[name] = value;
    if (name === 'date' && state.form.time && value === minDate() && state.form.time < minTime()) state.form.time = '';
    render();
  }
});

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  switch (action) {
    case 'open-gift': openGift(button); break;
    case 'yes': state.answer = 'yes'; setScreen('date'); break;
    case 'no': setScreen('rethink'); break;
    case 'decline':
      state.answer = 'no'; state.form = emptyForm(); setScreen('decline'); sendAnswer('no'); break;
    case 'retry': sendAnswer('no'); break;
    case 'back-invite': setScreen('invite'); break;
    case 'next-date': {
      const error = validateDate();
      if (error) { state.error = error; render(); return; }
      setScreen('activities'); break;
    }
    case 'toggle-activity': {
      const selected = new Set(state.form.activities);
      selected.has(id) ? selected.delete(id) : selected.add(id);
      state.form.activities = activities.map((item) => item.id).filter((key) => selected.has(key));
      state.error = '';
      render(); break;
    }
    case 'back-date': setScreen('date'); break;
    case 'next-activities':
      if (!state.form.activities.length) { state.error = 'Хамтдаа хийх зүйлээсээ дор хаяж нэгийг сонгоорой.'; render(); return; }
      if (state.form.activities.includes('custom') && !state.form.customActivity.trim()) { state.error = 'Өөр саналынхаа бичвэрийг оруулаарай.'; render(); return; }
      setScreen('confirm'); break;
    case 'edit': setScreen('activities'); break;
    case 'send': sendAnswer('yes'); break;
  }
});

window.setInterval(() => {
  if (state.screen === 'success') {
    const card = app.querySelector('.countdown');
    if (!card) return;
    const updated = renderSuccess();
    const template = document.createElement('template');
    template.innerHTML = updated;
    const newCountdown = template.content.querySelector('.countdown');
    if (newCountdown) card.replaceWith(newCountdown);
  }
}, 1000);

render();
if (state.screen === 'decline' && state.answer === 'no' && !state.sentAt && !state.sending && !state.error) sendAnswer('no');
