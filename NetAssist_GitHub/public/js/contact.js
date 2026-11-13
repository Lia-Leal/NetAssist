const form = NA.$('#f'), err = NA.$('#err'), done = NA.$('#done'), go = NA.$('#go');
NA.init({ active: 'contact', pub: undefined }).then((u) => { if (u) { form.name.value = u.name; form.email.value = u.email; } const s = new URLSearchParams(location.search).get('subject'); if (s) form.subject.value = s; });
form.addEventListener('submit', async (e) => {
  e.preventDefault(); FK.clear(form); FK.banner(err, ''); done.hidden = true;
  const v = { name: form.name.value, email: form.email.value, subject: form.subject.value, message: form.message.value };
  go.disabled = true; go.textContent = 'Sending…';
  try { await NA.api('POST', '/api/contact', v); done.hidden = false; form.subject.value = ''; form.message.value = ''; }
  catch (ex) { if (!(ex.field && FK.mark(form, ex.field, ex.message))) FK.banner(err, ex.message); }
  go.disabled = false; go.textContent = 'Send message';
});
