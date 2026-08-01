import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const googleClientId=Deno.env.get("GOOGLE_CLIENT_ID")!;
const googleClientSecret=Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const googleRefreshToken=Deno.env.get("GOOGLE_REFRESH_TOKEN")!;
const googleCalendarId=Deno.env.get("GOOGLE_CALENDAR_ID")||"primary";

async function getGoogleAccessToken(){
  const response=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:googleClientId,
      client_secret:googleClientSecret,
      refresh_token:googleRefreshToken,
      grant_type:"refresh_token"
    })
  });
  if(!response.ok) throw new Error(await response.text());
  return await response.json();
}

Deno.serve(async request=>{
  try{
    if(request.method!=="POST") throw new Error("Method not allowed.");
    const authHeader=request.headers.get("Authorization");
    if(!authHeader) throw new Error("Unauthorized.");

    const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
    const {data:authData,error:authError}=await userClient.auth.getUser();
    if(authError||!authData.user) throw new Error("Unauthorized.");

    const admin=createClient(supabaseUrl,serviceKey);
    const {appointment_id}=await request.json();

    const {data:appointment,error:appointmentError}=await admin
      .from("appointments")
      .select("id,client_id,counsellor_id,scheduled_at,scheduled_end_at,status,google_meet_url")
      .eq("id",appointment_id)
      .single();

    if(appointmentError) throw appointmentError;
    if(!["approved","confirmed"].includes(appointment.status)) throw new Error("Appointment must be approved or confirmed.");
    if(![appointment.client_id,appointment.counsellor_id].includes(authData.user.id)) throw new Error("You are not part of this appointment.");
    if(appointment.google_meet_url) return new Response(JSON.stringify({google_meet_url:appointment.google_meet_url}),{headers:{"Content-Type":"application/json"}});

    if(!appointment.scheduled_at) throw new Error("Appointment start time is missing.");
    const start=new Date(appointment.scheduled_at);
    const end=appointment.scheduled_end_at?new Date(appointment.scheduled_end_at):new Date(start.getTime()+60*60*1000);

    const [{data:clientAuth},{data:counsellorAuth}]=await Promise.all([
      admin.auth.admin.getUserById(appointment.client_id),
      admin.auth.admin.getUserById(appointment.counsellor_id)
    ]);

    const token=await getGoogleAccessToken();
    const requestId=crypto.randomUUID();

    const eventBody={
      summary:"MindMitra Nepal Counselling Appointment",
      description:"Private counselling appointment arranged through MindMitra Nepal.",
      start:{dateTime:start.toISOString()},
      end:{dateTime:end.toISOString()},
      attendees:[
        {email:clientAuth.user?.email},
        {email:counsellorAuth.user?.email}
      ].filter(item=>item.email),
      conferenceData:{
        createRequest:{
          requestId,
          conferenceSolutionKey:{type:"hangoutsMeet"}
        }
      }
    };

    const eventResponse=await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method:"POST",
        headers:{
          Authorization:`Bearer ${token.access_token}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify(eventBody)
      }
    );

    if(!eventResponse.ok) throw new Error(await eventResponse.text());
    const event=await eventResponse.json();
    const meetUrl=event.hangoutLink||event.conferenceData?.entryPoints?.find((entry:any)=>entry.entryPointType==="video")?.uri;
    if(!meetUrl) throw new Error("Google Meet link was not returned.");

    const {error:updateError}=await admin.from("appointments").update({
      google_event_id:event.id,
      google_meet_url:meetUrl,
      meeting_created_at:new Date().toISOString(),
      scheduled_end_at:end.toISOString(),
      status:"confirmed"
    }).eq("id",appointment.id);
    if(updateError) throw updateError;

    return new Response(JSON.stringify({google_meet_url:meetUrl,google_event_id:event.id}),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    return new Response(JSON.stringify({error:error.message}),{status:400,headers:{"Content-Type":"application/json"}});
  }
});