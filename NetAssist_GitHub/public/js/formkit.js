// Tiny form helpers shared by login/register/contact.
const FK = {
  clear(form) { form.querySelectorAll('.field').forEach((f) => { f.classList.remove('invalid'); const e = f.querySelector('.err'); if (e) e.textContent = ''; }); },
  mark(form, name, msg) {
    const input = form.elements[name]; if (!input) return false;
    const f = input.closest('.field'); f.classList.add('invalid'); f.querySelector('.err').textContent = msg; input.focus(); return true;
  },
  banner(el, msg) { el.textContent = msg; el.hidden = !msg; },
  eye(inputId, btnId) {
    const i = document.getElementById(inputId), b = document.getElementById(btnId); if (!i || !b) return;
    b.innerHTML = NA.icon('eye');
    b.onclick = () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); };
  },
};
