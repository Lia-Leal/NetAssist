NA.init({ pub: 'none' });
const form = NA.$('#f'), err = NA.$('#err'), go = NA.$('#go');
const params = new URLSearchParams(location.search);
NA.$('#pts').innerHTML = ['Six common problems, one guided wizard', 'Plain-language results and fixes', 'Private history with before and after'].map((t) => `<li>${NA.icon('check')}${t}</li>`).join('');
FK.eye('password', 'eye');
// Remember me: the email (never the password) is kept in this browser and the server keeps a hashed token in the database.
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
const savedEmail = LS.get('na-remember-email');
if (savedEmail) form.email.value = savedEmail;
if (LS.get('na-remember-off') === '1') NA.$('#remember').checked = false;
const fill = () => { form.email.value = 'demo@netassist.local'; form.password.value = 'Demo@123'; };
NA.$('#fill').onclick = fill; if (params.get('demo')) fill();

form.addEventListener('submit', async (e) => {
  e.preventDefault(); FK.clear(form); FK.banner(err, '');
  if (!form.email.value.trim()) return FK.mark(form, 'email', 'Enter your email.');
  if (!form.password.value) return FK.mark(form, 'password', 'Enter your password.');
  go.disabled = true; go.textContent = 'Signing in…';

  try {
    await NA.api('POST', '/api/auth/login', { email: form.email.value, password: form.password.value, remember: NA.$('#remember').checked });
    const keep = NA.$('#remember').checked;
    LS.set('na-remember-email', keep ? form.email.value.trim().toLowerCase() : null); LS.set('na-remember-off', keep ? null : '1');
    const next = params.get('next');
    location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  } catch (ex) { FK.banner(err, ex.message); go.disabled = false; go.textContent = 'Sign in'; }
});
