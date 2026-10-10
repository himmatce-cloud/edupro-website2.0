import { currentUser, loadPayments, savePayments, getUser, saveUser, isPaid, body } from './_lib/auth.js';
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const me = await currentUser(req);
    if (!me || !me.admin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const d = await loadPayments();
    if (req.method === 'POST') {
      const b = body(req), it = d.items.find(x => x.id === b.id && x.status === 'pending');
      if (!it) return res.status(404).json({ ok: false, error: 'अनुरोध नहीं मिला' });
      if (b.action === 'approve') {
        const u = await getUser(it.mobile); if (!u) return res.status(404).json({ ok: false, error: 'छात्र नहीं मिला' });
        const base = u.paidUntil && new Date(u.paidUntil) > new Date() ? new Date(u.paidUntil) : new Date();
        base.setDate(base.getDate() + 30);
        u.paidUntil = base.toISOString(); await saveUser(u);
        it.status = 'approved'; it.expiry = u.paidUntil;
        // Referral: every 5th PAID referral of a currently-paid referrer adds 30 days.
        if (u.ref && !u.refCounted) {
          const r = await getUser(u.ref);
          if (r && isPaid(r) && !(r.paidRefs || []).includes(u.mobile)) {
            r.paidRefs = (r.paidRefs || []).concat(u.mobile);
            if (r.paidRefs.length % 5 === 0) { const e = new Date(r.paidUntil); e.setDate(e.getDate() + 30); r.paidUntil = e.toISOString(); }
            await saveUser(r); u.refCounted = true; await saveUser(u);
          }
        }
      } else if (b.action === 'reject') { it.status = 'rejected'; it.reason = String(b.reason || '').slice(0, 120); }
      else return res.status(400).json({ ok: false, error: 'bad action' });
      it.decidedAt = new Date().toISOString(); await savePayments(d);
    }
    const f = x => ({ id: x.id, name: x.name, mobile: x.mobile, utr: x.utr, amount: '₹' + x.amount, target: 'All-Access Pass', time: new Date(x.createdAt).toLocaleString('en-IN'), proofImg: '', expiry: x.expiry ? new Date(x.expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' });
    const seen = new Set();
    res.status(200).json({ ok: true, pending: d.items.filter(x => x.status === 'pending').map(f), verified: d.items.filter(x => x.status === 'approved' && !seen.has(x.mobile) && seen.add(x.mobile)).map(f) });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'server' }); }
}
