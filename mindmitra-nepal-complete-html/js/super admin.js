(() => {
  const $ = selector => document.querySelector(selector);
  const api = window.mindMitraApi;
  const openDashboard = () => { $('#super-login').classList.add('hidden'); $('#super-dashboard').classList.remove('hidden'); };
  $('#super-demo').onclick = openDashboard;

  $('#super-form').onsubmit = async event => {
    event.preventDefault();
    const errorBox = $('#super-error');
    errorBox.classList.add('hidden');
    try {
      const result = await api.post('/auth/login', { email: $('#super-email').value.trim(), password: $('#super-password').value, role: 'super_admin' });
      if (result.user.role !== 'super_admin') throw new Error('This account is not authorized for Super Admin access.');
      openDashboard();
    } catch (error) { errorBox.textContent = error.message; errorBox.classList.remove('hidden'); }
  };

  $('#super-logout').onclick = async () => {
    await api.post('/auth/logout');
    $('#super-dashboard').classList.add('hidden');
    $('#super-login').classList.remove('hidden');
  };
})();
