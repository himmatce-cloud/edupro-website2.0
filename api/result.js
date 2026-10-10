import { currentUser, getUser, saveUser, ensureRefCode, body } from './_lib/auth.js';
import { STREAMS } from './_lib/config.js';
export const config = { maxDuration: 30 };

const ist = t => new Date(new Date(t).getTime() + 19800000).toISOString().slice(0, 10);   // IST calendar day
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));

function stats(u) {
  const h = u.history || [], today = ist(Date.now());
  const days = new Set(h.map(x => ist(x.at)));
  let streak = 0, d = new Date(Date.now() + 19800000);
  if (!days.has(today)) d = new Date(d.getTime() - 864e5);
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d = new Date(d.getTime() - 864e5); }
  const att = h.reduce((a, x) => a + x.correct + x.wrong, 0), cor = h.reduce((a, x) => a + x.correct, 0);
  return { tests: h.length, attempted: att, accuracy: att ? Math.round((cor / att) * 1000) / 10 : 0, best: h.length ? Math.max(...h.map(x => x.score)) : 0, streak,
    todayMin: Math.round(h.filter(x => ist(x.at) === today).reduce((a, x) => a + x.secs, 0) / 60), recent: h.slice(-6).reverse() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'login required' });
    const u = await getUser(me.mobile);
    if (req.method === 'POST') {
      const b = body(req), s = STREAMS.find(x => x[0] === String(b.streamId));
      if (!s) return res.status(400).json({ ok: false, error: 'bad stream' });
      const correct = clamp(b.correct, 0, 100), wrong = clamp(b.wrong, 0, 100 - correct), skipped = clamp(b.skipped, 0, 100 - correct - wrong);
      u.history = (u.history || []).concat([{ at: new Date().toISOString(), streamId: s[0], stream: s[1], set: clamp(b.set, 1, 99999), correct, wrong, skipped, score: clamp(b.score, -100, 400), max: clamp(b.max, 0, 400), secs: clamp(b.secs, 0, 7200) }]).slice(-100);
      await saveUser(u);
    }
    const code = await ensureRefCode(u), n = (u.paidRefs || []).length;
    res.status(200).json({ ok: true, user: me, ...stats(u), refCode: code, refPaid: n, refRewards: Math.floor(n / 5) });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'server' }); }
}
