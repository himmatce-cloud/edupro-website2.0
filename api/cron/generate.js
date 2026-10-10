import { STREAMS } from '../_lib/config.js';
import { readJson, writeJson } from '../_lib/blob.js';
export const config = { maxDuration: 300 };
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const PER_RUN_STREAMS = 5, PER_PART = 15, POOL_MAX = 300, TARGET = 25;

async function ai(system, user) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({ model: MODEL, temperature: 0.4, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  if (!r.ok) throw new Error('OpenAI ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return JSON.parse((await r.json()).choices[0].message.content);
}
const norm = s => s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, '');
const ok = x => x && x.en && x.hi && [x.en, x.hi].every(l => typeof l.q === 'string' && l.q.length > 10 && Array.isArray(l.o) && l.o.length === 4 && new Set(l.o.map(norm)).size === 4) && [0, 1, 2, 3].includes(x.a);

const HARD = new Set(['6', '7', '8', '9', '10', '11', '16', '17', '18']);   // competitive / engineering: real previous-year difficulty
async function makePart(streamId, stream, [subject, book, topics], existing) {
  const avoid = existing.slice(-40).map(x => x.en.q).join(' | ');
  const list = String(topics || '').split(';').map(s => s.trim()).filter(Boolean);
  const k = Math.floor(existing.length / PER_PART);                       // rotate through the syllabus so every chapter gets covered
  const focus = list.length ? [0, 1, 2].map(i => list[(k * 3 + i) % list.length]).join('; ') : subject;
  const level = HARD.has(streamId) ? 'previous-year competitive/university exam difficulty: concept- and application-based, NOT one-line trivia' : 'board-exam difficulty strictly from the textbook';
  const gen = await ai(
    'You are a senior Indian exam paper-setter. Reply ONLY with JSON {"questions":[{"en":{"q":"","o":["","","",""]},"hi":{"q":"","o":["","","",""]},"a":0,"ch":"","tr":""}]}. "tr" is a short catchy Hinglish memory trick/mnemonic (max 20 words) that helps remember the correct answer. "a" is the 0-3 index of the single correct option; "hi" is the faithful Hindi version; "ch" is the chapter/topic in the reference book. Only use facts that are standard in the named reference books and current Indian rules/codes; if unsure of a fact, do not write that question.',
    `Stream: ${stream}. Subject: ${subject} ONLY. Reference book(s): ${book}. Cover these chapters/topics in this batch: ${focus}. Write ${PER_PART} NEW factual single-correct MCQs, ${level}. 4 distinct plausible options, no "all of the above", no ambiguous or opinion questions, vary the correct index. Do not repeat: ${avoid || 'none'}`);
  const cands = (gen.questions || []).filter(ok);
  if (!cands.length) return [];
  // independent verification: solve blind, keep only if answers match the key
  const ver = await ai('Solve each MCQ carefully. Reply ONLY with JSON {"answers":[index 0-3 or -1 if ambiguous/wrong, one per question]}.',
    JSON.stringify(cands.map(c => ({ q: c.en.q, o: c.en.o }))));
  const seen = new Set(existing.map(x => norm(x.en.q)));
  const out = [];
  cands.forEach((c, i) => {
    const k = norm(c.en.q);
    if (ver.answers?.[i] !== c.a || seen.has(k)) return;   // wrong key or duplicate -> drop
    seen.add(k);
    out.push({ id: Date.now().toString(36) + '-' + i + '-' + Math.random().toString(36).slice(2, 6), en: c.en, hi: c.hi, a: c.a, ch: c.ch || subject, tr: String(c.tr || '').slice(0, 160) });
  });
  return out;
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).end('unauthorized');
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY missing' });
  try {
    // Load all 20 pools, then work on the streams that have the FEWEST questions first (fills every stream evenly).
    const states = await Promise.all(STREAMS.map(async ([id, name, parts]) => {
      const data = (await readJson(`eduq/s-${id}.json`)) || { parts: [] };
      parts.forEach(([subject, book], p) => { data.parts[p] = { subject, book, pool: data.parts[p]?.pool || [] }; });
      return { id, name, parts, data, min: Math.min(...data.parts.map(x => x.pool.length)) };
    }));
    const batch = states.filter(s => s.min < POOL_MAX).sort((a, b) => a.min - b.min).slice(0, PER_RUN_STREAMS);
    const report = await Promise.all(batch.map(async s => {
      const added = await Promise.all(s.parts.map((_, p) => makePart(s.id, s.name, s.parts[p], s.data.parts[p].pool).catch(e => { console.error(s.id, p, e.message); return []; })));
      added.forEach((a, p) => { s.data.parts[p].pool = s.data.parts[p].pool.concat(a).slice(-POOL_MAX); });
      s.data.updated = new Date().toISOString();
      await writeJson(`eduq/s-${s.id}.json`, s.data);
      return { stream: s.id, added: added.map(a => a.length), pool: s.data.parts.map(x => x.pool.length) };
    }));
    const ready = states.filter(s => !batch.includes(s) && s.min >= TARGET).length + report.filter(r => Math.min(...r.pool) >= TARGET).length;
    res.status(200).json({ ok: true, streamsReady: ready + '/20', report });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, error: e.message }); }
}
