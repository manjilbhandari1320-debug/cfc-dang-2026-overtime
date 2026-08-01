(() => {
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const configured=window.MINDMITRA_SUPABASE_URL&&!window.MINDMITRA_SUPABASE_URL.includes('YOUR_PROJECT_REF');
const sb=configured?window.supabase.createClient(window.MINDMITRA_SUPABASE_URL,window.MINDMITRA_SUPABASE_ANON_KEY):null;
const appointmentId=new URLSearchParams(location.search).get('appointment');

$$('[data-rating]').forEach(button=>{
  button.onclick=()=>{
    const rating=Number(button.dataset.rating);
    $('#rating-value').value=rating;
    $$('[data-rating]').forEach(star=>star.classList.toggle('active',Number(star.dataset.rating)<=rating));
  };
});

$('#feedback-form').onsubmit=async event=>{
  event.preventDefault();
  const status=$('#feedback-status');
  const rating=Number($('#rating-value').value);
  if(!rating){status.textContent='Choose a rating first.';return;}

  try{
    if(sb){
      const {data:{user}}=await sb.auth.getUser();
      if(!user) throw new Error('Please sign in again.');

      const {data:appointment,error:appointmentError}=await sb
        .from('appointments')
        .select('id,client_id,counsellor_id')
        .eq('id',appointmentId)
        .single();
      if(appointmentError) throw appointmentError;
      if(appointment.client_id!==user.id) throw new Error('You are not allowed to rate this appointment.');

      const {error}=await sb.from('appointment_feedback').insert({
        appointment_id:appointment.id,
        client_id:user.id,
        counsellor_id:appointment.counsellor_id,
        rating,
        felt_listened_to:$('#felt-listened').checked,
        helpful_session:$('#helpful-session').checked,
        easy_to_join:$('#easy-to-join').checked,
        recommend_counsellor:$('#recommend-counsellor').checked,
        feedback:$('#feedback-text').value.trim()||null
      });
      if(error) throw error;
    }

    status.textContent='Thank you. Your feedback has been submitted.';
    event.target.reset();
    $$('[data-rating]').forEach(star=>star.classList.remove('active'));
  }catch(error){
    status.textContent=error.message;
  }
};
})();