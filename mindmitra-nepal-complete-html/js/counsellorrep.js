(() => {
const $=s=>document.querySelector(s);
const configured=window.MINDMITRA_SUPABASE_URL&&!window.MINDMITRA_SUPABASE_URL.includes('YOUR_PROJECT_REF');
const sb=configured?window.supabase.createClient(window.MINDMITRA_SUPABASE_URL,window.MINDMITRA_SUPABASE_ANON_KEY):null;
const appointmentId=new URLSearchParams(location.search).get('appointment');

async function getContext(){
  if(!sb) return {user:{id:'demo-counsellor'},appointment:{id:appointmentId,client_id:null}};
  const {data:{user}}=await sb.auth.getUser();
  if(!user) throw new Error('Please sign in again.');

  const {data:appointment,error}=await sb
    .from('appointments')
    .select('id,client_id,counsellor_id')
    .eq('id',appointmentId)
    .single();
  if(error) throw error;
  if(appointment.counsellor_id!==user.id) throw new Error('You are not assigned to this appointment.');
  return {user,appointment};
}

$('#save-report').onclick=async()=>{
  const status=$('#report-status');
  const notes=$('#private-notes').value.trim();
  if(!notes){status.textContent='Enter private notes first.';return;}

  try{
    const {user,appointment}=await getContext();
    if(sb){
      const {error}=await sb.from('counsellor_notes').insert({
        counsellor_id:user.id,
        appointment_id:appointment.id,
        client_id:appointment.client_id,
        private_note:notes
      });
      if(error) throw error;
    }
    status.textContent='Private notes saved. They were not shared.';
  }catch(error){
    status.textContent=error.message;
  }
};

$('#publish-report').onclick=async()=>{
  const status=$('#report-status');
  const report=$('#organization-report').value.trim();
  if(!report){status.textContent='Write an organization-safe report first.';return;}
  if(!$('#consent-confirmed').checked){status.textContent='Client consent must be confirmed before publishing.';return;}

  try{
    const {user,appointment}=await getContext();
    if(sb){
      const {data:client,error:clientError}=await sb
        .from('profiles')
        .select('organization_id')
        .eq('id',appointment.client_id)
        .single();
      if(clientError) throw clientError;

      const {data:privacy}=await sb
        .from('privacy_preferences')
        .select('share_identity_with_counsellor,anonymous_alias')
        .eq('user_id',appointment.client_id)
        .maybeSingle();

      const displayName=privacy?.share_identity_with_counsellor
        ? 'Client'
        : privacy?.anonymous_alias||'Anonymous Client';

      const {error}=await sb.from('organization_reports').insert({
        counsellor_id:user.id,
        organization_id:client.organization_id,
        appointment_id:appointment.id,
        client_id:appointment.client_id,
        client_display_name:displayName,
        report_summary:report,
        client_consent_confirmed:true,
        status:'published',
        published_at:new Date().toISOString()
      });
      if(error) throw error;
    }

    status.textContent='Organization-safe report published.';
    $('#organization-report').value='';
    $('#consent-confirmed').checked=false;
  }catch(error){
    status.textContent=error.message;
  }
};
})();