// Shared client helper: asks the server who is logged in (cookie session). Nothing here is trusted for security.
window.EDU = { user: null };
EDU.ready = fetch('/api/auth', { credentials: 'same-origin', cache: 'no-store' })
  .then(r => r.json()).then(d => {
    EDU.user = d.user || null;
    try {
      if (EDU.user) { sessionStorage.setItem('edupro_student_phone', EDU.user.mobile); sessionStorage.setItem('edupro_student_name', EDU.user.name); }
      else { ['edupro_student_phone', 'edupro_student_name', 'edupro_student_auth'].forEach(k => sessionStorage.removeItem(k)); }
    } catch (e) {}
    return EDU.user;
  }).catch(() => null);
EDU.require = async function (opts) {
  const u = await EDU.ready;
  if (!u || (opts && opts.admin && !u.admin)) { location.replace('login.html'); return null; }
  return u;
};
EDU.logout = async function () { try { await fetch('/api/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); } catch (e) {} sessionStorage.clear(); location.href = 'login.html'; };
