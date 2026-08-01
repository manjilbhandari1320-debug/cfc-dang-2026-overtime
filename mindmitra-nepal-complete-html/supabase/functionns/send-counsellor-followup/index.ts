import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend=Deno.env.get("RESEND_API_KEY")!;
const fromEmail=Deno.env.get("FROM_EMAIL")||"MindMitra Nepal <hello@mindmitranepal.com>";

async function sendEmail(to:string,subject:string,html:string){
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:fromEmail,to:[to],subject,html})
  });
  if(!response.ok) throw new Error(await response.text());
  return await response.json();
}

Deno.serve(async(request)=>{
  try{
    if(request.method!=="POST") throw new Error("Method not allowed.");
    const authHeader=request.headers.get("Authorization");
    if(!authHeader) throw new Error("Unauthorized.");

    const userClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
    const {data:authData,error:authError}=await userClient.auth.getUser();
    if(authError||!authData.user) throw new Error("Unauthorized.");

    const admin=createClient(url,service);
    const {data:profile,error:profileError}=await admin.from("profiles").select("role").eq("id",authData.user.id).single();
    if(profileError) throw profileError;
    if(profile.role!=="counsellor") throw new Error("Only counsellors may send follow-up emails.");

    const {appointment_id,message}=await request.json();
    if(!appointment_id||!message?.trim()) throw new Error("Appointment and message are required.");

    const {data:appointment,error:appointmentError}=await admin
      .from("appointments")
      .select("id,client_id,counsellor_id,status,completed_at")
      .eq("id",appointment_id)
      .single();

    if(appointmentError) throw appointmentError;
    if(appointment.counsellor_id!==authData.user.id) throw new Error("This appointment is not assigned to you.");
    if(appointment.status!=="completed"||!appointment.completed_at) throw new Error("The first appointment must be completed.");

    const completed=new Date(appointment.completed_at);
    const deadline=new Date(completed);
    deadline.setUTCDate(deadline.getUTCDate()+7);
    const now=new Date();
    if(now<completed||now>deadline) throw new Error("The seven-day follow-up window has ended.");

    const {data:existing}=await admin
      .from("counsellor_followup_emails")
      .select("id")
      .eq("appointment_id",appointment.id)
      .maybeSingle();
    if(existing) throw new Error("A follow-up email has already been sent for this appointment.");

    const {data:authUser,error:userError}=await admin.auth.admin.getUserById(appointment.client_id);
    if(userError) throw userError;
    const email=authUser.user?.email;
    if(!email) throw new Error("Client email is unavailable.");

    const result=await sendEmail(
      email,
      "A follow-up from your MindMitra counsellor",
      `<p>Hello,</p><p>${message.trim()}</p><p>You can return to MindMitra Nepal whenever you would like to review your options or request another appointment.</p><p>Take care,<br>MindMitra Nepal</p>`
    );

    await admin.from("counsellor_followup_emails").insert({
      counsellor_id:authData.user.id,
      client_id:appointment.client_id,
      appointment_id:appointment.id,
      message:message.trim(),
      provider_message_id:result.id,
      status:"sent",
      sent_at:new Date().toISOString()
    });

    return new Response(JSON.stringify({success:true}),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    return new Response(JSON.stringify({error:error.message}),{status:400,headers:{"Content-Type":"application/json"}});
  }
});