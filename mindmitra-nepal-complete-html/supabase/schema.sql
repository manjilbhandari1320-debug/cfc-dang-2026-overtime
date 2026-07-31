create extension if not exists pgcrypto;

create type public.app_role as enum ('client','counsellor','organization','admin','super_admin');
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
  status public.appointment_status not null default 'requested',
  whatsapp_link text,
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
alter table public.counsellor_profiles enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.ai_reports enable row level security;
alter table public.appointments enable row level security;
alter table public.crisis_helplines enable row level security;

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select role from public.profiles where id=auth.uid() $$;

create policy "read own profile" on public.profiles for select using (id=auth.uid());
create policy "admin profile access" on public.profiles for select using (public.current_role() in ('admin','super_admin'));
create policy "client own assessments" on public.assessment_sessions for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "client own answers" on public.assessment_answers for all using (
  exists(select 1 from public.assessment_sessions s where s.id=session_id and s.user_id=auth.uid())
) with check (
  exists(select 1 from public.assessment_sessions s where s.id=session_id and s.user_id=auth.uid())
);
create policy "client own reports" on public.ai_reports for select using (user_id=auth.uid());
create policy "appointment participants" on public.appointments for select using (client_id=auth.uid() or counsellor_id=auth.uid() or public.current_role() in ('admin','super_admin'));
create policy "active helplines public authenticated" on public.crisis_helplines for select using (is_active=true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 insert into public.profiles(id,full_name,role)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce((new.raw_user_meta_data->>'role')::public.app_role,'client'));
 return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Important: organization-created temporary accounts and admin invitations
-- must be implemented through a Supabase Edge Function using the service-role key.
-- Never expose the service-role key in frontend JavaScript.
