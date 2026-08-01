import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async(request)=>{
  if(request.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:{"Content-Type":"application/json"}});
  try{
    const authHeader=request.headers.get("Authorization");
    if(!authHeader) throw new Error("Missing authorization header.");

    const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
    const {data:authData,error:authError}=await userClient.auth.getUser();
    if(authError||!authData.user) throw new Error("Unauthorized.");

    const admin=createClient(supabaseUrl,serviceRoleKey);
    const {data:requester,error:requesterError}=await admin.from("profiles").select("role,organization_id").eq("id",authData.user.id).single();
    if(requesterError) throw requesterError;
    if(requester.role!=="organization_admin") throw new Error("Only Organization Admins may create users.");
    if(!requester.organization_id) throw new Error("Organization Admin is not linked to an organization.");

    const body=await request.json();
    const {full_name,email,username,temporary_password,member_type,department,allow_anonymous_counselling=true}=body;
    if(!full_name||!email||!username||!temporary_password) throw new Error("Required fields are missing.");
    if(!["student","employee"].includes(member_type)) throw new Error("Invalid member type.");
    if(temporary_password.length<8) throw new Error("Temporary password must be at least 8 characters.");

    const {data:created,error:createError}=await admin.auth.admin.createUser({email,password:temporary_password,email_confirm:true,user_metadata:{full_name,role:"client"}});
    if(createError) throw createError;

    const {error:profileError}=await admin.from("profiles").update({full_name,role:"client",organization_id:requester.organization_id,username,member_type,department:department||null,allow_anonymous_counselling,first_login:true}).eq("id",created.user.id);
    if(profileError){await admin.auth.admin.deleteUser(created.user.id);throw profileError;}

    await admin.from("privacy_preferences").upsert({user_id:created.user.id,share_identity_with_counsellor:!allow_anonymous_counselling,anonymous_alias:`Mitra-${created.user.id.slice(0,6).toUpperCase()}`});
    await admin.from("notification_preferences").upsert({user_id:created.user.id,monthly_wellness_email:true,appointment_followup_email:true});
    await admin.from("audit_logs").insert({actor_id:authData.user.id,action:"organization_user_created",entity_type:"profile",entity_id:created.user.id,metadata:{username,member_type}});

    return new Response(JSON.stringify({success:true,user_id:created.user.id,email,username}),{headers:{"Content-Type":"application/json"}});
  }catch(error){
    return new Response(JSON.stringify({error:error.message}),{status:400,headers:{"Content-Type":"application/json"}});
  }
});