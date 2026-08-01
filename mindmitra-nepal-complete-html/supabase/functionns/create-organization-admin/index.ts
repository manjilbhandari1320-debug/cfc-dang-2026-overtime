import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const provisioningSecret = Deno.env.get("ORG_ADMIN_PROVISIONING_SECRET")!;

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") {
      throw new Error("Method not allowed.");
    }

    const suppliedSecret = request.headers.get("x-provisioning-secret");
    if (!suppliedSecret || suppliedSecret !== provisioningSecret) {
      throw new Error("Unauthorized provisioning request.");
    }

    const {
      organization_id,
      full_name,
      email,
      temporary_password,
    } = await request.json();

    if (!organization_id || !full_name || !email || !temporary_password) {
      throw new Error("Organization, name, email and temporary password are required.");
    }

    if (temporary_password.length < 8) {
      throw new Error("Temporary password must contain at least 8 characters.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id,name,status")
      .eq("id", organization_id)
      .single();

    if (organizationError) throw organizationError;
    if (!organization) throw new Error("Organization was not found.");

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: "organization_admin",
      },
    });

    if (createError) throw createError;

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name,
        role: "organization_admin",
        organization_id,
        first_login: true,
        is_active: true,
      })
      .eq("id", created.user.id);

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    await admin.from("audit_logs").insert({
      actor_id: null,
      action: "organization_admin_provisioned",
      entity_type: "profile",
      entity_id: created.user.id,
      metadata: {
        organization_id,
        email,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: created.user.id,
        email,
        organization: organization.name,
        must_change_password: true,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});