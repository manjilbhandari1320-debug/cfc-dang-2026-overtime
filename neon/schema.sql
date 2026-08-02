create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  role text not null default 'client' check (role in ('client','counsellor','organization_admin','super_admin')),
  organization_id uuid references organizations(id) on delete set null,
  username text,
  member_type text check (member_type in ('student','employee')),
  department text,
  first_login boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists users_email_lower_uidx on users (lower(email));
create unique index if not exists users_username_lower_uidx on users (lower(username)) where username is not null;

create table if not exists user_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists user_sessions_user_idx on user_sessions(user_id);

create table if not exists privacy_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  share_identity_with_counsellor boolean not null default true,
  anonymous_alias text,
  updated_at timestamptz not null default now(),
  check (share_identity_with_counsellor or anonymous_alias is not null)
);

create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  monthly_wellness_email boolean not null default true,
  appointment_followup_email boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists counsellor_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  phone text,
  professional_title text,
  licence_number text,
  biography text,
  years_experience integer,
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
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected','more_info','suspended'))
);

create table if not exists assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'completed',
  progress integer not null default 100,
  answers jsonb not null default '[]'::jsonb,
  lifestyle jsonb not null default '{}'::jsonb,
  total_score integer,
  result_level text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists ai_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references assessment_sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  user_summary jsonb not null,
  counsellor_summary jsonb,
  risk_level text not null check (risk_level in ('low','moderate','elevated','urgent')),
  urgent_human_review boolean not null default false,
  consent_to_share boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  counsellor_id uuid not null references users(id) on delete cascade,
  scheduled_at timestamptz,
  scheduled_end_at timestamptz,
  completed_at timestamptz,
  status text not null default 'requested',
  google_event_id text,
  google_meet_url text,
  meeting_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists counsellor_notes (
  id uuid primary key default gen_random_uuid(),
  counsellor_id uuid not null references users(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  client_id uuid references users(id) on delete set null,
  private_note text not null,
  created_at timestamptz not null default now()
);

create table if not exists organization_reports (
  id uuid primary key default gen_random_uuid(),
  counsellor_id uuid not null references users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  client_id uuid references users(id) on delete set null,
  client_display_name text not null,
  report_summary text not null,
  client_consent_confirmed boolean not null default false,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'published' or client_consent_confirmed)
);

create table if not exists counsellor_followup_emails (
  id uuid primary key default gen_random_uuid(),
  counsellor_id uuid not null references users(id) on delete cascade,
  client_id uuid not null references users(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  message text not null,
  status text not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

create table if not exists appointment_feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  client_id uuid not null references users(id) on delete cascade,
  counsellor_id uuid not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  felt_listened_to boolean,
  helpful_session boolean,
  easy_to_join boolean,
  recommend_counsellor boolean,
  feedback text,
  created_at timestamptz not null default now(),
  unique (appointment_id, client_id)
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
