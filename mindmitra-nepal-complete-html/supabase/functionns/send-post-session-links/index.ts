import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend=Deno.env.get("RESEND_API_KEY")!;
const fromEmail=Deno.env.get("FROM_EMAIL")||"MindMitra Nepal <hello@mindmitranepal.com>";
const siteUrl=Deno.env.get("SITE_URL")||"https://mindmitranepal.com";

const admin=createClient(url,service);

async function sendEmail(to:string,subject:string,html:string){
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:fromEmail,to:[to],subject,html})
  });
  if(!response.ok) throw new Error(await response.text());
  return await response.json();
}

Deno.serve(async()=>{
  try{
    const now=new Date().toISOString();
    const {data:appointments,error}=await admin
      .from("appointments")
      .select("id,client_id,counsellor_id,scheduled_end_at,post_session_links_sent_at")
      .is("post_session_links_sent_at",null)
      .not("scheduled_end_at","is",null)
      .lte("scheduled_end_at",now)
      .in("status",["confirmed","completed"]);

    if(error) throw error;
    let sent=0;

    for(const appointment of appointments||[]){
      const [{data:clientAuth},{data:counsellorAuth}]=await Promise.all([
        admin.auth.admin.getUserById(appointment.client_id),
        admin.auth.admin.getUserById(appointment.counsellor_id)
      ]);

      const feedbackUrl=`${siteUrl}/session-feedback.html?appointment=${appointment.id}`;
      const reportUrl=`${siteUrl}/counsellor-report.html?appointment=${appointment.id}`;

      if(clientAuth.user?.email){
        const response=await sendEmail(
          clientAuth.user.email,
          "How was your MindMitra session?",
          `<p>Your scheduled session has ended.</p><p><a href="${feedbackUrl}">Rate your session and share feedback</a></p>`
        );
        await admin.from("post_session_notification_logs").insert({
          appointment_id:appointment.id,
          recipient_role:"client",
          recipient_user_id:appointment.client_id,
          link_type:"feedback",
          provider_message_id:response.id,
          status:"sent"
        });
        sent++;
      }

      if(counsellorAuth.user?.email){
        const response=await sendEmail(
          counsellorAuth.user.email,
          "Complete your MindMitra session documentation",
          `<p>Your scheduled session has ended.</p><p><a href="${reportUrl}">Write private notes and the counsellor report</a></p>`
        );
        await admin.from("post_session_notification_logs").insert({
          appointment_id:appointment.id,
          recipient_role:"counsellor",
          recipient_user_id:appointment.counsellor_id,
          link_type:"report",
          provider_message_id:response.id,
          status:"sent"
        });
        sent++;
      }

      await admin.from("appointments").update({
        session_ended_at:appointment.scheduled_end_at,
        post_session_links_sent_at:new Date().toISOString(),
        status:"completed"
      }).eq("id",appointment.id);
    }

    return new Response(JSON.stringify({sent}),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    return new Response(JSON.stringify({error:error.message}),{status:500,headers:{"Content-Type":"application/json"}});
  }
});