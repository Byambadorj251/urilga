import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 3000;
const timeZone = 'Asia/Ulaanbaatar';
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const allowedActivities = new Map([
  ['coffee', '☕ Кофе ууж ярилцах'],
  ['movie', '🎬 Кино үзэх'],
  ['meal', '🍜 Хоол идэх'],
  ['walk', '🌳 Хамт алхах'],
  ['game', '🎮 Тоглоом тоглох'],
  ['surprise', '🎁 Чи намайг гайхшруул'],
  ['custom', '✍️ Өөр санал'],
]);
const submissions = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '12kb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function missingConfiguration() {
  const isMissingOrPlaceholder = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return !normalized || normalized.startsWith('your-')
      || normalized.includes('placeholder') || normalized.includes('app-password');
  };
  return ['RESEND_API_KEY', 'RECIPIENT_EMAIL']
    .some((key) => isMissingOrPlaceholder(process.env[key]));
}

function validEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
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

function formatMongolianDate(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('mn-MN', {
    timeZone, weekday: 'long',
  }).format(new Date(zonedTimestamp(date, time)));
  return `${year} оны ${month}-р сарын ${day}, ${weekday}, ${time} цагт`;
}

function formatSentAt() {
  const time = new Intl.DateTimeFormat('mn-MN', {
    timeZone, dateStyle: 'long', timeStyle: 'medium',
  }).format(new Date());
  return `${time} (${timeZone})`;
}

function optionalLine(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Сонгоогүй';
}

function buildEmail(data, receivedAt) {
  const accepted = data.answer === 'yes';
  const answer = accepted ? 'YES 💖 — Тийм, болзоонд явна' : 'NO 🙈 — Энэ удаа амжихгүй';
  const date = accepted ? formatMongolianDate(data.date, data.time) : 'Сонгоогүй';
  const activities = accepted && data.activities.length
    ? data.activities.map((item) => {
      if (item === 'custom') return `${allowedActivities.get(item)}: ${optionalLine(data.customActivity)}`;
      return allowedActivities.get(item);
    })
    : ['Сонгоогүй'];
  const details = [
    ['Хариу', answer],
    ['Өдөр, цаг', date],
    ['Хийх зүйл', activities.join(', ')],
    ['Уулзах газар', accepted ? optionalLine(data.place) : 'Сонгоогүй'],
    ['Нэмэлт зурвас', accepted ? optionalLine(data.note) : 'Сонгоогүй'],
    ['Хариу ирсэн цаг', receivedAt],
  ];
  const text = [
    'Чамд нэг жижигхэн бэлэг байна 🎁 — болзооны урилгаас хариу ирлээ!',
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
  const rows = details.map(([label, value]) => `
    <tr>
      <th align="left" style="padding:10px 14px;border-bottom:1px solid #f3e6ea;color:#76636a;font-weight:600">${escapeHtml(label)}</th>
      <td style="padding:10px 14px;border-bottom:1px solid #f3e6ea;color:#382d33">${escapeHtml(value)}</td>
    </tr>`).join('');
  const html = `<!doctype html><html lang="mn"><body style="margin:0;padding:28px 12px;background:#fff8f7;font-family:Arial,sans-serif;color:#382d33">
    <div style="max-width:580px;margin:0 auto;padding:28px;border:1px solid #f2e2e7;border-radius:20px;background:#fff">
      <h1 style="margin:0 0 8px;font-size:24px">💌 Болзооны урилгын хариу</h1>
      <p style="margin:0 0 20px;color:#76636a">Хөөрхөн урилгаас чинь шинэ хариу ирлээ.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="margin:22px 0 0;color:#9a7481;font-size:12px">Ирсэн цагийг Asia/Ulaanbaatar цагаар харуулав.</p>
    </div>
  </body></html>`;
  return { answer, text, html };
}

function validateSubmission(body) {
  if (!body || (body.answer !== 'yes' && body.answer !== 'no')) return 'Хариу буруу байна.';
  if (body.answer === 'no') return null;
  if (typeof body.date !== 'string' || typeof body.time !== 'string') return 'Өдөр, цагаа сонгоно уу.';
  const timestamp = zonedTimestamp(body.date, body.time);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return 'Өнгөрсөн өдөр, цаг сонгох боломжгүй.';
  if (!Array.isArray(body.activities) || body.activities.length < 1 || body.activities.length > allowedActivities.size
      || body.activities.some((activity) => !allowedActivities.has(activity))) return 'Хийх зүйлээсээ сонгоно уу.';
  if (body.activities.includes('custom') && (typeof body.customActivity !== 'string' || !body.customActivity.trim())) {
    return 'Өөр саналынхаа бичвэрийг оруулна уу.';
  }
  if (typeof body.customActivity === 'string' && body.customActivity.length > 500) return 'Өөр санал 500 тэмдэгтээс богино байна уу.';
  if (typeof body.place === 'string' && body.place.length > 300) return 'Уулзах газрын нэрийг богино бичнэ үү.';
  if (typeof body.note === 'string' && body.note.length > 1500) return 'Нэмэлт зурвас 1500 тэмдэгтээс богино байна уу.';
  return null;
}

async function sendWithResend(email, idempotencyKey) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: 'Bolzoony urilga <onboarding@resend.dev>',
      to: [process.env.RECIPIENT_EMAIL.trim()],
      subject: `Болзооны урилгын хариу: ${email.answer}`,
      text: email.text,
      html: email.html,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || result.name || 'Resend email илгээх хүсэлтийг зөвшөөрсөнгүй.');
    error.status = response.status;
    throw error;
  }
  return result;
}

app.post('/api/invite', async (req, res) => {
  if (missingConfiguration() || !validEmail(process.env.RECIPIENT_EMAIL.trim())) {
    return res.status(503).json({
      success: false,
      setupRequired: true,
      message: 'Email илгээх тохиргоо дутуу байна. .env файлд Resend-ээс авсан RESEND_API_KEY болон RECIPIENT_EMAIL утгаа оруулаад серверээ дахин асаана уу.',
    });
  }

  const requestId = req.get('Idempotency-Key');
  if (!requestId || !/^[\w-]{20,80}$/.test(requestId)) {
    return res.status(400).json({ success: false, message: 'Илгээх хүсэлтийн түлхүүр буруу байна. Дахин оролдоно уу.' });
  }
  const validationError = validateSubmission(req.body);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  const existing = submissions.get(requestId);
  if (existing?.status === 'sent') return res.status(200).json(existing.response);
  if (existing?.status === 'sending') {
    try {
      return res.status(200).json(await existing.promise);
    } catch {
      return res.status(502).json({ success: false, message: 'И-мэйл илгээж чадсангүй. Дахин оролдоно уу.' });
    }
  }

  const receivedAt = formatSentAt();
  const email = buildEmail(req.body, receivedAt);
  const response = { success: true, answer: req.body.answer, receivedAt };
  const promise = sendWithResend(email, requestId);
  const entry = { status: 'sending', promise };
  submissions.set(requestId, entry);
  try {
    await promise;
    entry.status = 'sent';
    entry.response = response;
    entry.sentAt = Date.now();
    for (const [key, cached] of submissions) {
      if (cached.status === 'sent' && Date.now() - cached.sentAt > 24 * 60 * 60 * 1000) submissions.delete(key);
    }
    return res.status(201).json(response);
  } catch (error) {
    submissions.delete(requestId);
    console.error('Resend-ээр и-мэйл илгээхэд алдаа гарлаа:', error.message);
    const message = error.status === 401
      ? 'Resend API түлхүүр буруу байна. .env дахь RESEND_API_KEY утгаа шалгаарай.'
      : error.status === 403
        ? 'Resend тест горимд бүртгэлийн Gmail хаяг руу л илгээнэ. Resend-д byambadorj023@gmail.com хаягаар бүртгүүлсэн эсэхээ шалгаарай.'
        : 'И-мэйл илгээж чадсангүй. Сонголтоо хадгаллаа — дахин оролдоод үзээрэй.';
    return res.status(502).json({
      success: false,
      setupRequired: false,
      message,
    });
  }
});

app.use(express.static(publicDir, { index: 'index.html', maxAge: '1h' }));
app.get('*splat', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Хүсэлт хэт урт байна.' });
  console.error('Серверийн алдаа:', error.message);
  return res.status(500).json({ success: false, message: 'Серверт алдаа гарлаа. Дахин оролдоно уу.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Болзооны урилга ажиллаж байна: http://localhost:${port}`);
  if (missingConfiguration()) console.log('Мэдэгдэл илгээхэд .env.example дахь RESEND_API_KEY болон RECIPIENT_EMAIL шаардлагатай.');
});
