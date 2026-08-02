(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const api = window.mindMitraApi;
  const appointmentId = new URLSearchParams(window.location.search).get('appointment');
  const status = $('#feedback-status');

  if (!appointmentId) status.textContent = 'Appointment information is missing.';

  $$('[data-rating]').forEach(button => button.addEventListener('click', () => {
    const rating = Number(button.dataset.rating);
    $('#rating-value').value = rating;
    $$('[data-rating]').forEach(star => star.classList.toggle('active', Number(star.dataset.rating) <= rating));
  }));

  $('#feedback-form').addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = '';
    const rating = Number($('#rating-value').value);
    if (!rating) return void (status.textContent = 'Please choose a rating.');
    if (!appointmentId) return void (status.textContent = 'Appointment information is missing.');
    try {
      await api.post('/feedback', {
        appointment_id: appointmentId,
        rating,
        felt_listened_to: $('#felt-listened').checked,
        helpful_session: $('#helpful-session').checked,
        easy_to_join: $('#easy-to-join').checked,
        recommend_counsellor: $('#recommend-counsellor').checked,
        feedback: $('#feedback-text').value.trim() || null
      });
      status.textContent = 'Thank you. Your feedback was submitted successfully.';
      event.target.reset();
      $$('[data-rating]').forEach(star => star.classList.remove('active'));
    } catch (error) { status.textContent = error.message || 'Unable to submit feedback.'; }
  });
})();
