const { createHash } = require('node:crypto');

const WALL_URL = 'https://my-halloween2026.vercel.app/';
const PHOTO_API = 'https://vjugsidfdovuwtxgcvrz.supabase.co/rest/v1/wall_photos';
const PHOTO_KEY = 'sb_publishable_Q_HeljHf6jSNZm7nONcazw_JIlEZRVS';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const enabled = process.env.WALL_EMAIL_ENABLED === 'true' && Boolean(process.env.RESEND_API_KEY);
  if (req.method === 'GET') return res.status(200).json({ enabled });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const origins = [new URL(WALL_URL).origin];
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) origins.push('https://' + process.env.VERCEL_URL);
  if (!origins.includes(req.headers.origin)) return res.status(403).json({ error: 'Please use the photo wall to request your link.' });
  if (!enabled) return res.status(503).json({ error: 'Email is not available yet. Your photo is already on the wall.' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return res.status(415).json({ error: 'Use a JSON request.' });
  if (Number(req.headers['content-length'] || 0) > 4096) return res.status(413).json({ error: 'Request is too large.' });
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > 4096) return res.status(413).json({ error: 'Request is too large.' });
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid request.' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid request.' });
  if (body.website) return res.status(400).json({ error: 'Please try again.' });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const photoId = typeof body.photoId === 'string' ? body.photoId : '';
  if (email.length > 254 || !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(photoId)) return res.status(400).json({ error: 'Please pin a photo first.' });
  try {
    const photoResponse = await fetch(`${PHOTO_API}?select=public_id,created_at&public_id=eq.${encodeURIComponent(photoId)}&approved=eq.true&limit=1`, {
      headers: { apikey: PHOTO_KEY, Authorization: `Bearer ${PHOTO_KEY}` }, signal: AbortSignal.timeout(6000),
    });
    if (!photoResponse.ok) throw new Error('photo_lookup_failed');
    const photos = await photoResponse.json();
    const age = photos?.[0]?.created_at ? Date.now() - Date.parse(photos[0].created_at) : Infinity;
    if (photos?.[0]?.public_id !== photoId || !Number.isFinite(age) || age < -60000 || age > 60 * 60 * 1000) return res.status(400).json({ error: 'Please request the link just after pinning your photo.' });
    // The provider deduplicates repeated requests for this address for the day.
    const idempotency = createHash('sha256').update('halloween-wall-link:v1:' + email + ':' + new Date().toISOString().slice(0, 10)).digest('hex');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'wall-link-' + idempotency },
      body: JSON.stringify({
        from: 'Narwhall <hello@mail.narwhall.app>', to: [email], subject: 'Your Narwhall Halloween wall link',
        text: `Your photo is on the wall!\n\nRevisit the Halloween wall here:\n${WALL_URL}\n\nYou asked us to email this link after posting a photo. This does not subscribe you to marketing emails.\n\nNarwhall`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#21140f;background:#fff7ed"><p style="font-weight:bold;letter-spacing:3px;color:#d85009">NARWHALL</p><h1>Your photo is on the wall!</h1><p>Here is your link to all the Halloween moments.</p><p style="margin:28px 0"><a href="${WALL_URL}" style="display:inline-block;background:#f76b16;color:#21140f;text-decoration:none;padding:15px 22px;border-radius:6px;font-weight:bold">Back to the Halloween wall</a></p><p><a href="${WALL_URL}">${WALL_URL}</a></p><p style="font-size:12px;line-height:1.6;color:#6e5548">You asked us to email this link after posting a photo. This does not subscribe you to marketing emails.</p></div>`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('Wall link email rejected', { status: response.status });
      return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'Email limit reached. Please try again later.' : 'We could not send the link. Please try again later; your photo is already on the wall.' });
    }
    const sent = await response.json();
    if (!sent.id) throw new Error('missing_email_id');
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Wall link email failed', { type: error.name });
    return res.status(502).json({ error: 'We could not send the link. Please try again later; your photo is already on the wall.' });
  }
};
