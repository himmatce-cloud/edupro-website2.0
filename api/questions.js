import { STREAMS } from './_lib/config.js';
import { readJson } from './_lib/blob.js';
import { currentUser } from './_lib/auth.js';
export const config = { maxDuration: 30 };
const PER_PART = 25, FREE = 30;   // free trial = first 30 questions; the rest are withheld by the SERVER unless the pass is active

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export default async function handler(req, res) {
  const id = String(req.query.stream || '');
  const set = Math.max(1, parseInt(req.query.set || '1', 10) || 1);
  const def = STREAMS.find(s => s[0] === id);
  if (!def) return res.status(404).json({ ready: false, error: 'unknown stream' });
  let paid = false;
  try { paid = !!(await currentUser(req))?.paid; } catch (e) { /* AUTH_SECRET not set -> treated as unpaid */ }
  try {
    const data = await readJson(`eduq/s-${id}.json`);
    const have = def[2].map((_, p) => (data?.parts?.[p]?.pool || []).length);
    if (have.some(n => n < PER_PART)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ready: false, have, need: PER_PART });
    }
    // Every part = its OWN subject pool only (no mixing). Each new "set" moves to a fresh window of the pool.
    const parts = def[2].map(([subject, book], p) => {
      const pool = data.parts[p].pool, n = pool.length, start = ((set - 1) * PER_PART) % n, seen = new Set(), pick = [];
      for (let k = 0; pick.length < PER_PART && k < n; k++) { const q = pool[(start + k) % n]; if (!seen.has(q.id)) { seen.add(q.id); pick.push(q); } }
      const r = rng(set * 131 + p * 17 + Number(id));
      for (let i = pick.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
      const lock = { locked: true, a: -1, ch: '', tr: '', en: { q: '🔒 Locked', o: ['', '', '', ''] }, hi: { q: '🔒 Locked', o: ['', '', '', ''] } };
      return { subject, book, q: pick.map((x, k) => (!paid && p * PER_PART + k >= FREE) ? { id: x.id, ...lock } : { id: x.id, en: x.en, hi: x.hi, a: x.a, ch: x.ch, tr: x.tr || '' }) };
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({ ready: true, paid, set, poolSize: have, parts });
  } catch (e) { console.error(e); res.status(500).json({ ready: false, error: 'server' }); }
}
