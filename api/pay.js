import { currentUser, loadPayments, savePayments, body } from './_lib/auth.js';
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const u = await currentUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'पहले लॉगिन करें' });
    const d = await loadPayments();
    if (req.method === 'GET') return res.status(200).json({ ok: true, paid: u.paid, expiry: u.expiry, items: d.items.filter(x => x.mobile === u.mobile).map(({ id, utr, status, createdAt, reason }) => ({ id, utr, status, createdAt, reason })) });
    if (req.method !== 'POST') return res.status(405).end();
    const utr = String(body(req).utr || '').trim();
    if (!/^\d{12}$/.test(utr)) return res.status(400).json({ ok: false, error: 'सही 12 अंकों का UTR / UPI Ref No. दर्ज करें' });
    if (d.items.some(x => x.utr === utr && x.status !== 'rejected')) return res.status(409).json({ ok: false, error: 'यह UTR पहले ही जमा हो चुका है' });
    if (d.items.filter(x => x.mobile === u.mobile && x.status === 'pending').length >= 3) return res.status(429).json({ ok: false, error: 'आपके 3 अनुरोध पहले से लंबित हैं' });
    const item = { id: 'REQ-' + Date.now().toString(36).toUpperCase(), mobile: u.mobile, name: u.name, utr, amount: 199, status: 'pending', createdAt: new Date().toISOString() };
    d.items.unshift(item); await savePayments(d);
    return res.status(200).json({ ok: true, id: item.id });
  } catch (e) { console.error(e); return res.status(500).json({ ok: false, error: 'सर्वर त्रुटि' }); }
}
