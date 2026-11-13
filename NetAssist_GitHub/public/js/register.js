NA.init({ pub: 'none' });
const form = NA.$('#f'), err = NA.$('#err'), go = NA.$('#go');
NA.$('#pts').innerHTML = ['Free, no installation needed', 'Reports saved privately to your account', 'Analytics that show your progress'].map((t) => `<li>${NA.icon('check')}${t}</li>`).join('');
FK.eye('password', 'eye');
form.addEventListener('submit', async (e) => {
  e.preventDefault(); FK.clear(form); FK.banner(err, '');
  const v = { name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value, remember: NA.$('#remember').checked };
  if (v.name.length < 2) return FK.mark(form, 'name', 'Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return FK.mark(form, 'email', 'Enter a valid email address.');
  if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) return FK.mark(form, 'password', 'At least 8 characters, with a letter and a number.');
  go.disabled = true; go.textContent = 'Creating account…';
  try { await NA.api('POST', '/api/auth/register', v); try { if (v.remember) localStorage.setItem('na-remember-email', v.email.toLowerCase()); localStorage.removeItem('na-remember-off'); if (!v.remember) { localStorage.removeItem('na-remember-email'); localStorage.setItem('na-remember-off', '1'); } } catch (e) { /* ignore */ } location.href = '/dashboard'; }
  catch (ex) { if (!(ex.field && FK.mark(form, ex.field, ex.message))) FK.banner(err, ex.message); go.disabled = false; go.textContent = 'Create account'; }
});
