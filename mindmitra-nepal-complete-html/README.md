# MindMitra Nepal — HTML/CSS/JS + Supabase

This ZIP contains:

- Public homepage explaining MindMitra Nepal
- Student/Employee panel
- Counsellor panel
- Organization panel
- Admin panel
- Super Admin panel
- Responsive dark forest, sand and gold UI
- Supabase authentication connection
- Starter PostgreSQL schema and RLS policies
- Demo panel mode that works before Supabase is configured

## Run the website

Open PowerShell in the extracted folder:

```powershell
npx serve .
```

Open the local URL displayed in PowerShell.

## Connect Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Open **Project Settings → API**.
5. Copy the Project URL and anon/public key.
6. Open `js/supabase-config.js`.
7. Replace the placeholder values.

Never put the Supabase service-role key in frontend files.

## Test without Supabase

Open any login portal and click **Open demo panel**.

## Roles

- `client` — student or employee
- `counsellor`
- `organization`
- `admin`
- `super_admin`

Admin and Super Admin accounts should be invitation-only.

## Important production work still required

This package is a substantial frontend prototype and backend starter, not a finished clinical production system. Before real use, add:

- Secure Edge Functions for organization-created users
- Full assessment question database
- AI backend service and safety review
- Secure document storage
- Malware scanning
- MFA for counsellors/admins
- Email notifications
- Audit logging for all sensitive actions
- Verified Nepal helpline data
- Legal/privacy review
- Full testing and penetration testing
