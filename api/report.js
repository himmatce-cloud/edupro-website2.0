import { currentUser, anon, body } from './_lib/auth.js';
import { readJson, writeJson } from './_lib/blob.js';
import { STREAMS } from './_lib/config.js';
export const config = { maxDuration: 30 };
const REMOVE_AT = 3;   // distinct students reporting the same question -> it is removed from the pool

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'पहले लॉगिन करें' });
    const b = body(req), qid = String(b.qid || '').slice(0, 60);
    if (!STREAMS.some(s => s[0] === String(b.streamId)) || !qid) return res.status(400).json({ ok: false, error: 'bad request' });
    const rp = (await readJson('eduq/reports.json')) || {}, key = b.streamId + ':' + qid, who = anon(me.mobile);
    const r = rp[key] || { users: [], reasons: [] };
    if (!r.users.includes(who)) { r.users.push(who); r.reasons.push(String(b.reason || '').slice(0, 100)); }
    rp[key] = r;
    let removed = false;
    if (r.users.length >= REMOVE_AT) {
      const data = await readJson(`eduq/s-${b.streamId}.json`);
      if (data) { data.parts.forEach(p => { const n = p.pool.length; p.pool = p.pool.filter(q => q.id !== qid); if (p.pool.length < n) removed = true; }); if (removed) await writeJson(`eduq/s-${b.streamId}.json`, data); }
    }
    await writeJson('eduq/reports.json', rp);
    res.status(200).json({ ok: true, removed });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'server' }); }
}
