import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "MindMitra Nepal <hello@mindmitranepal.com>";

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

Deno.serve(async () => {
  const today = new Date();
  const period = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString().slice(0, 10);

  const { data: users, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      notification_preferences!inner(
        monthly_wellness_email,
        appointment_followup_email,
        email_enabled
      )
    `)
    .eq("role", "client")
    .eq("is_active", true);

  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;

  for (const profile of users ?? []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser.user?.email;
    if (!email) continue;

    const prefs = Array.isArray(profile.notification_preferences)
      ? profile.notification_preferences[0]
      : profile.notification_preferences;

    if (!prefs?.email_enabled) continue;

    const monthAgoStart = new Date(today);
    monthAgoStart.setUTCMonth(monthAgoStart.getUTCMonth() - 1);
    monthAgoStart.setUTCDate(today.getUTCDate());
    monthAgoStart.setUTCHours(0, 0, 0, 0);

    const monthAgoEnd = new Date(monthAgoStart);
    monthAgoEnd.setUTCDate(monthAgoEnd.getUTCDate() + 1);

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id,completed_at")
      .eq("client_id", profile.id)
      .eq("status", "completed")
      .gte("completed_at", monthAgoStart.toISOString())
      .lt("completed_at", monthAgoEnd.toISOString());

    let appointmentFollowupSent = false;

    if (prefs.appointment_followup_email && appointments?.length) {
      for (const appointment of appointments) {
        const { data: existing } = await supabase
          .from("reminder_logs")
          .select("id")
          .eq("user_id", profile.id)
          .eq("appointment_id", appointment.id)
          .eq("reminder_type", "appointment_followup")
          .eq("reminder_period", period)
          .maybeSingle();

        if (existing) continue;

        const result = await sendEmail(
          email,
          "A gentle MindMitra check-in",
          `<p>Hey ${profile.full_name || "there"}, how are you?</p>
           <p>You had an appointment with MindMitra one month ago today. We hope you have been doing well.</p>
           <p>Whenever you would like to reconnect with a MindMitra counsellor, we are here for you.</p>
           <p>Take care,<br>MindMitra Nepal</p>`
        );

        await supabase.from("reminder_logs").insert({
          user_id: profile.id,
          appointment_id: appointment.id,
          reminder_type: "appointment_followup",
          reminder_period: period,
          provider_message_id: result.id,
          status: "sent",
        });

        sent++;
        appointmentFollowupSent = true;
      }
    }

    if (!appointmentFollowupSent && prefs.monthly_wellness_email && today.getUTCDate() === 1) {
      const { data: existing } = await supabase
        .from("reminder_logs")
        .select("id")
        .eq("user_id", profile.id)
        .is("appointment_id", null)
        .eq("reminder_type", "monthly_wellness")
        .eq("reminder_period", period)
        .maybeSingle();

      if (!existing) {
        const result = await sendEmail(
          email,
          "Your monthly MindMitra wellness reminder",
          `<p>Hello ${profile.full_name || "there"},</p>
           <p>This is a gentle reminder to take a moment to check in with yourself, rest when you need to, and reach out for support when it would help.</p>
           <p>MindMitra Nepal is here whenever you would like to explore wellness resources or connect with a counsellor.</p>
           <p>Take care,<br>MindMitra Nepal</p>`
        );

        await supabase.from("reminder_logs").insert({
          user_id: profile.id,
          appointment_id: null,
          reminder_type: "monthly_wellness",
          reminder_period: period,
          provider_message_id: result.id,
          status: "sent",
        });

        sent++;
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});