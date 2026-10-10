import { getUser, saveUser, validMobile, isAdminMobile, same, hashSecret, newSalt, makeCookie, clearCookie, currentUser, body, findRef, ensureRefCode } from './_lib/auth.js';
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return res.status(200).json({ user: await currentUser(req) });
    if (req.method !== 'POST') return res.status(405).end();
    const b = body(req), mobile = String(b.mobile || '').trim();

    if (b.action === 'logout') { res.setHeader('Set-Cookie', clearCookie()); return res.status(200).json({ ok: true }); }
    if (!validMobile(mobile)) return res.status(400).json({ ok: false, error: '10 अंकों का सही मोबाइल नंबर दर्ज करें' });
    const adminOk = () => process.env.ADMIN_PIN && same(String(b.adminPin || ''), process.env.ADMIN_PIN);

    if (b.action === 'register') {
      const name = String(b.name || '').trim().slice(0, 60), pw = String(b.password || ''), pin = String(b.pin || '');
      if (name.length < 2) return res.status(400).json({ ok: false, error: 'पूरा नाम लिखें' });
      if (pw.length < 6) return res.status(400).json({ ok: false, error: 'पासवर्ड कम से कम 6 अक्षर का रखें' });
      if (!/^\d{4}$/.test(pin)) return res.status(400).json({ ok: false, error: '4-अंक का गुप्त पिन चुनें (पासवर्ड भूलने पर काम आएगा)' });
      if (isAdminMobile(mobile) && !adminOk()) return res.status(200).json({ ok: false, needPin: true });
      if (await getUser(mobile)) return res.status(409).json({ ok: false, error: 'यह मोबाइल पहले से पंजीकृत है, लॉगिन करें' });
      const salt = newSalt();
      const ref = await findRef(b.ref);
      const nu = { mobile, name, salt, hash: hashSecret(pw, salt), pinHash: hashSecret(pin, salt), paidUntil: null, created: new Date().toISOString(), fails: 0, ref: ref && ref !== mobile ? ref : null };
      await saveUser(nu); await ensureRefCode(nu);
      return res.status(200).json({ ok: true });
    }

    const u = await getUser(mobile);
    const locked = u && u.lockUntil && new Date(u.lockUntil) > new Date();
    if (locked) return res.status(429).json({ ok: false, error: 'बहुत ज़्यादा गलत प्रयास। 15 मिनट बाद फिर कोशिश करें' });
    const fail = async () => { if (u) { u.fails = (u.fails || 0) + 1; if (u.fails >= 5) { u.lockUntil = new Date(Date.now() + 15 * 60e3).toISOString(); u.fails = 0; } await saveUser(u); } return res.status(401).json({ ok: false, error: 'मोबाइल या पासवर्ड/पिन गलत है' }); };

    if (b.action === 'login') {
      if (!u || !same(hashSecret(b.password || '', u.salt), u.hash)) return fail();
      let admin = false;
      if (isAdminMobile(mobile)) { if (!adminOk()) return res.status(200).json({ ok: false, needPin: true }); admin = true; }
      u.fails = 0; await saveUser(u);
      res.setHeader('Set-Cookie', makeCookie(mobile, admin));
      return res.status(200).json({ ok: true, user: await currentUser({ headers: { cookie: 'edu_session=' + makeCookie(mobile, admin).split(';')[0].slice(12) } }) });
    }
    if (b.action === 'reset') {
      const np = String(b.password || '');
      if (np.length < 6) return res.status(400).json({ ok: false, error: 'नया पासवर्ड कम से कम 6 अक्षर का रखें' });
      if (!u || !same(hashSecret(b.pin || '', u.salt), u.pinHash)) return fail();
      u.hash = hashSecret(np, u.salt); u.fails = 0; await saveUser(u);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'bad action' });
  } catch (e) { console.error(e); return res.status(500).json({ ok: false, error: 'सर्वर त्रुटि: ' + String((e && e.message) || e).slice(0, 160) }); }
}
