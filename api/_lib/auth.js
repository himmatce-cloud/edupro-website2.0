import crypto from 'node:crypto';
import { readJson, writeJson } from './blob.js';

const secret = () => { if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) throw new Error('AUTH_SECRET missing (min 16 chars)'); return process.env.AUTH_SECRET; };
const hmac = s => crypto.createHmac('sha256', secret()).update(s).digest('hex');
export const userPath = m => `u/${hmac('user:' + m).slice(0, 40)}.json`;      // unguessable storage path
export const payPath = () => `u/p-${hmac('payments').slice(0, 40)}.json`;
export const validMobile = m => /^[6-9]\d{9}$/.test(m);
export const isAdminMobile = m => !!process.env.ADMIN_MOBILE && m === process.env.ADMIN_MOBILE;
export const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const hashSecret = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
export const newSalt = () => crypto.randomBytes(16).toString('hex');

export const getUser = m => readJson(userPath(m));
export const saveUser = u => writeJson(userPath(u.mobile), u);
export const loadPayments = async () => (await readJson(payPath())) || { items: [] };
export const savePayments = d => writeJson(payPath(), d);

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export function makeCookie(mobile, admin) {
  const body = b64({ m: mobile, a: admin ? 1 : 0, exp: Date.now() + 30 * 864e5 });
  return `edu_session=${body}.${hmac(body)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`;
}
export const clearCookie = () => 'edu_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
export function session(req) {
  try {
    const c = (req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith('edu_session='));
    if (!c) return null;
    const [body, sig] = c.slice(12).split('.');
    if (!body || !sig || !same(sig, hmac(body))) return null;
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    return d.exp > Date.now() ? { mobile: d.m, admin: d.a === 1 && isAdminMobile(d.m) } : null;
  } catch (e) { return null; }
}
export const isPaid = u => !!(u && u.paidUntil && new Date(u.paidUntil) >= new Date());
export async function currentUser(req) {
  const s = session(req); if (!s) return null;
  const u = await getUser(s.mobile); if (!u) return null;
  return { mobile: u.mobile, name: u.name, paid: isPaid(u), expiry: u.paidUntil || null, admin: s.admin };
}
export const body = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {});

export const refIndexPath = () => `u/r-${hmac('refs').slice(0, 40)}.json`;
export async function ensureRefCode(u) {
  if (u.refCode) return u.refCode;
  const idx = (await readJson(refIndexPath())) || {}, code = 'EDU-' + hmac('ref:' + u.mobile).slice(0, 6).toUpperCase();
  idx[code] = u.mobile; await writeJson(refIndexPath(), idx);
  u.refCode = code; await saveUser(u); return code;
}
export async function findRef(code) { const idx = (await readJson(refIndexPath())) || {}; return idx[String(code || '').trim().toUpperCase()] || null; }

export const anon = m => hmac('rep:' + m).slice(0, 12);
