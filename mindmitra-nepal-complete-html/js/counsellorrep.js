(() => {
  const $ = selector => document.querySelector(selector);
  const api = window.mindMitraApi;
  const appointmentId = new URLSearchParams(location.search).get('appointment');
  let appointment = null;

  async function getAppointment() {
    if (!appointmentId) throw new Error('Appointment information is missing.');
    if (!appointment) appointment = (await api.get(`/appointments/${encodeURIComponent(appointmentId)}`)).appointment;
    return appointment;
  }

  $('#save-report').onclick = async () => {
    const status = $('#report-status'), notes = $('#private-notes').value.trim();
    if (!notes) return void (status.textContent = 'Enter private notes first.');
    try {
      const item = await getAppointment();
      await api.post('/counsellor/notes', { appointment_id: item.id, client_id: item.client_id, private_note: notes });
      status.textContent = 'Private notes saved. They were not shared.';
    } catch (error) { status.textContent = error.message; }
  };

  $('#publish-report').onclick = async () => {
    const status = $('#report-status'), report = $('#organization-report').value.trim();
    if (!report) return void (status.textContent = 'Write an organization-safe report first.');
    if (!$('#consent-confirmed').checked) return void (status.textContent = 'Client consent must be confirmed before publishing.');
    try {
      const item = await getAppointment();
      await api.post('/counsellor/reports', { appointment_id: item.id, client_id: item.client_id, client_display_name: 'Anonymous Client', report_summary: report, client_consent_confirmed: true });
      status.textContent = 'Organization-safe report published.';
      $('#organization-report').value = '';
      $('#consent-confirmed').checked = false;
    } catch (error) { status.textContent = error.message; }
  };
})();
