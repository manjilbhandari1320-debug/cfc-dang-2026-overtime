create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type public.app_role as enum ('client','counsellor','organization_admin','super_admin');
create type public.verification_status as enum ('pending','approved','rejected','more_info','suspended');
create type public.risk_level as enum ('low','moderate','elevated','urgent');
create type public.appointment_status as enum ('requested','under_review','approved','rejected','reschedule_requested','confirmed','completed','cancelled','no_show');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'client',
  organization_id uuid references public.organizations(id),
  first_login boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.privacy_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  share_identity_with_counsellor boolean not null default true,
  anonymous_alias text,
  updated_at timestamptz not null default now(),
  constraint alias_required_when_anonymous check (
    share_identity_with_counsellor = true or anonymous_alias is not null
  )
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  monthly_wellness_email boolean not null default true,
  appointment_followup_email boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.counsellor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  professional_title text,
  licence_number text,
  biography text,
  years_experience int,
  specialities text[],
  languages text[],
  workplace text,
  address_line text,
  city text,
  district text,
  province text,
  latitude double precision,
  longitude double precision,
  service_radius_km integer not null default 25,
  whatsapp_enabled boolean not null default false,
  verification_status public.verification_status not null default 'pending'
);

create table public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  status text not null default 'in_progress',
  progress int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.assessment_sessions(id),
  user_id uuid not null references public.profiles(id),
  user_summary jsonb not null,
  counsellor_summary jsonb,
  risk_level public.risk_level not null,
  urgent_human_review boolean not null default false,
  consent_to_share boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  counsellor_id uuid not null references public.profiles(id),
  scheduled_at timestamptz,
  completed_at timestamptz,
  status public.appointment_status not null default 'requested',
  whatsapp_link text,
  created_at timestamptz not null default now()
);

create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  appointment_id uuid references public.appointments(id),
  reminder_type text not null check (reminder_type in ('appointment_followup','monthly_wellness')),
  reminder_period date not null,
  provider_message_id text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  unique(user_id, appointment_id, reminder_type, reminder_period)
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table public.crisis_helplines (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  phone_number text not null,
  region text,
  availability text,
  language text,
  service_type text,
  last_verified_at date,
  is_active boolean not null default true
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.privacy_preferences enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.counsellor_profiles enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.ai_reports enable row level security;
alter table public.appointments enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.contact_messages enable row level security;
alter table public.crisis_helplines enable row level security;

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create policy "read own profile" on public.profiles for select using (id=auth.uid());
create policy "super admin reads profiles" on public.profiles for select using (public.current_role()='super_admin');
create policy "organization admin reads own members" on public.profiles for select using (
  public.current_role()='organization_admin'
  and organization_id=(select organization_id from public.profiles where id=auth.uid())
);

create policy "own privacy preferences" on public.privacy_preferences for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own notification preferences" on public.notification_preferences for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy "client own assessments" on public.assessment_sessions for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "client own answers" on public.assessment_answers for all using (
  exists(select 1 from public.assessment_sessions s where s.id=session_id and s.user_id=auth.uid())
) with check (
  exists(select 1 from public.assessment_sessions s where s.id=session_id and s.user_id=auth.uid())
);

create policy "client own reports" on public.ai_reports for select using (user_id=auth.uid());
create policy "appointment participants" on public.appointments for select using (
  client_id=auth.uid() or counsellor_id=auth.uid() or public.current_role()='super_admin'
);
create policy "client creates appointment" on public.appointments for insert with check (client_id=auth.uid());
create policy "participants update appointment" on public.appointments for update using (client_id=auth.uid() or counsellor_id=auth.uid());

create policy "contact form insert" on public.contact_messages for insert with check (true);
create policy "super admin reads contact messages" on public.contact_messages for select using (public.current_role()='super_admin');
create policy "active helplines authenticated" on public.crisis_helplines for select using (is_active=true);

create or replace view public.counsellor_client_display
with (security_invoker=true)
as
select
  a.id as appointment_id,
  a.counsellor_id,
  a.client_id,
  case
    when coalesce(pp.share_identity_with_counsellor,true) then p.full_name
    else pp.anonymous_alias
  end as client_display_name,
  coalesce(pp.share_identity_with_counsellor,true) as identity_shared,
  a.status,
  a.scheduled_at
from public.appointments a
join public.profiles p on p.id=a.client_id
left join public.privacy_preferences pp on pp.user_id=a.client_id;


create index if not exists counsellor_profiles_location_idx
on public.counsellor_profiles (latitude, longitude)
where latitude is not null and longitude is not null;

create or replace function public.find_nearby_counsellors(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision default 100
)
returns table (
  counsellor_id uuid,
  full_name text,
  professional_title text,
  address_line text,
  city text,
  district text,
  province text,
  latitude double precision,
  longitude double precision,
  distance_km double precision
)
language sql
stable
security invoker
as $$
  select
    cp.user_id,
    p.full_name,
    cp.professional_title,
    cp.address_line,
    cp.city,
    cp.district,
    cp.province,
    cp.latitude,
    cp.longitude,
    (
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(user_lat)) *
          cos(radians(cp.latitude)) *
          cos(radians(cp.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) *
          sin(radians(cp.latitude))
        ))
      )
    ) as distance_km
  from public.counsellor_profiles cp
  join public.profiles p on p.id = cp.user_id
  where cp.verification_status = 'approved'
    and cp.latitude is not null
    and cp.longitude is not null
    and (
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(user_lat)) *
          cos(radians(cp.latitude)) *
          cos(radians(cp.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) *
          sin(radians(cp.latitude))
        ))
      )
    ) <= radius_km
  order by distance_km asc;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.profiles(id,full_name,role)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce((new.raw_user_meta_data->>'role')::public.app_role,'client'));
 insert into public.notification_preferences(user_id) values(new.id);
 if coalesce((new.raw_user_meta_data->>'role')::public.app_role,'client')='client' then
   insert into public.privacy_preferences(user_id,anonymous_alias)
   values(new.id,'Mitra-'||upper(substr(replace(new.id::text,'-',''),1,6)));
 end if;
 return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Configure this after deploying the Edge Function.
-- Replace PROJECT_REF and SERVICE_ROLE_KEY securely using Vault in production.
-- select cron.schedule(
--   'mindmitra-daily-reminder-check',
--   '0 3 * * *',
--   $$
--   select net.http_post(
--     url := 'https://PROJECT_REF.supabase.co/functions/v1/send-wellness-reminders',
--     headers := jsonb_build_object(
--       'Authorization','Bearer SERVICE_ROLE_KEY',
--       'Content-Type','application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Organization-created temporary accounts must be created through a secure
-- Edge Function using the service-role key. Never expose it in frontend JavaScript.

alter table public.profiles add column if not exists username text unique;
alter table public.profiles add column if not exists member_type text check (member_type in ('student','employee'));
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists allow_anonymous_counselling boolean not null default true;

create policy "authenticated users read approved counsellors" on public.counsellor_profiles for select using (verification_status='approved' or user_id=auth.uid() or public.current_role()='super_admin');
create policy "counsellor inserts own profile" on public.counsellor_profiles for insert with check (user_id=auth.uid());
create policy "counsellor updates own profile" on public.counsellor_profiles for update using (user_id=auth.uid()) with check (user_id=auth.uid());

grant execute on function public.find_nearby_counsellors(double precision,double precision,double precision) to authenticated;
grant execute on function public.find_nearby_counsellors(double precision,double precision,double precision) to anon;


-- ===== Functional v5 assessment configuration =====
create table if not exists public.assessment_result_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.assessment_sessions(id) on delete set null,
  total_score integer not null check (total_score between 0 and 60),
  result_level text not null check (result_level in ('Healthy','Mild Stress','Moderate Concern','High Concern')),
  lifestyle jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.assessment_result_history enable row level security;

create policy "clients read own assessment result history"
on public.assessment_result_history
for select
using (user_id = auth.uid());

create policy "clients insert own assessment result history"
on public.assessment_result_history
for insert
with check (user_id = auth.uid());


-- ===== v6 counsellor notes and organization-safe publishing =====
create table if not exists public.counsellor_notes (
  id uuid primary key default gen_random_uuid(),
  counsellor_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  private_note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_reports (
  id uuid primary key default gen_random_uuid(),
  counsellor_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  client_display_name text not null,
  report_summary text not null,
  client_consent_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  published_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint published_requires_consent check (
    status <> 'published' or client_consent_confirmed = true
  )
);

alter table public.counsellor_notes enable row level security;
alter table public.organization_reports enable row level security;

create policy "counsellors manage own private notes"
on public.counsellor_notes
for all
using (counsellor_id = auth.uid())
with check (counsellor_id = auth.uid());

create policy "counsellors manage own organization reports"
on public.organization_reports
for all
using (counsellor_id = auth.uid())
with check (counsellor_id = auth.uid());

create policy "organization admins read reports for own organization"
on public.organization_reports
for select
using (
  public.current_role() = 'organization_admin'
  and organization_id = (
    select organization_id from public.profiles where id = auth.uid()
  )
  and status = 'published'
);

create policy "super admin audits organization reports"
on public.organization_reports
for select
using (public.current_role() = 'super_admin');

-- Organization Admins never receive access to counsellor_notes.


-- ===== v7 emergency contacts and counsellor-controlled follow-up =====
create table if not exists public.counsellor_followup_emails (
  id uuid primary key default gen_random_uuid(),
  counsellor_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  message text not null,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(appointment_id)
);

alter table public.counsellor_followup_emails enable row level security;

create policy "counsellors read own followup emails"
on public.counsellor_followup_emails
for select
using (counsellor_id = auth.uid());

create policy "clients read own followup history"
on public.counsellor_followup_emails
for select
using (client_id = auth.uid());

insert into public.crisis_helplines
(service_name,phone_number,region,availability,language,service_type,last_verified_at,is_active)
values
('National Mental Health Helpline','1166','Nepal','Verify before production','Nepali/English','Mental health support',current_date,true),
('TUTH Crisis Line','9840021212','Nepal','Verify before production','Nepali/English','Urgent support',current_date,true),
('Nepal Police','100','Nepal','Emergency','Nepali/English','Emergency safety',current_date,true),
('National Women''s Commission','1145','Nepal','Verify before production','Nepali/English','Women and domestic safety support',current_date,true)
on conflict do nothing;


-- ===== v8 Google Meet and post-session feedback =====
alter table public.appointments
  add column if not exists google_event_id text,
  add column if not exists google_meet_url text,
  add column if not exists meeting_created_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists session_started_at timestamptz,
  add column if not exists session_ended_at timestamptz,
  add column if not exists feedback_status text not null default 'pending',
  add column if not exists counsellor_report_status text not null default 'pending',
  add column if not exists post_session_links_sent_at timestamptz;

create table if not exists public.appointment_feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  counsellor_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  felt_listened_to boolean,
  helpful_session boolean,
  easy_to_join boolean,
  recommend_counsellor boolean,
  feedback text,
  created_at timestamptz not null default now(),
  unique (appointment_id, client_id)
);

alter table public.appointment_feedback enable row level security;

create policy "clients insert own appointment feedback"
on public.appointment_feedback
for insert
with check (
  client_id = auth.uid()
  and exists (
    select 1 from public.appointments a
    where a.id = appointment_id and a.client_id = auth.uid()
  )
);

create policy "clients read own appointment feedback"
on public.appointment_feedback
for select
using (client_id = auth.uid());

create policy "counsellors read feedback for own appointments"
on public.appointment_feedback
for select
using (counsellor_id = auth.uid());

create table if not exists public.post_session_notification_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('client','counsellor')),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  link_type text not null check (link_type in ('feedback','report')),
  provider_message_id text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  unique (appointment_id, recipient_role, link_type)
);


-- ===== v9 Organization Admin provisioning =====
-- Super Admin UI has been removed. Platform owners manage the project through
-- the Supabase Dashboard and secure server-side tooling.

create table if not exists public.organization_admin_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.organization_admin_invitations enable row level security;

-- Organization Admin accounts must be created with Supabase Auth Admin API
-- or a protected Edge Function using the service-role key.
-- The temporary password is changed on first login because profiles.first_login=true.

create policy "organization admin reads own profile"
on public.profiles
for select
using (
  id = auth.uid()
  or (
    public.current_role() = 'organization_admin'
    and organization_id = (
      select organization_id from public.profiles where id = auth.uid()
    )
  )
);
