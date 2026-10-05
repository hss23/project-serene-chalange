-- Serene Mentors: relational product data (Supabase Postgres)
-- Access model: every table has RLS enabled and NO policies for anon/authenticated,
-- so only the server (Supabase secret key / service_role, after verifying the Firebase ID token) can read/write.

create extension if not exists pgcrypto;

-- App users, keyed by Firebase UID (identity provider is Firebase Auth, not Supabase Auth)
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  firebase_uid  text not null unique,
  email         text,
  display_name  text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table if not exists skills (
  id        serial primary key,
  name      text not null unique,
  category  text not null
);

-- Dataset B: mentors (candidates to be ranked)
create table if not exists mentors (
  id                text primary key,              -- e.g. 'mentor-01'
  name              text not null,
  headline          text not null,
  bio               text not null,
  industry          text not null,
  years_experience  int  not null check (years_experience >= 0),
  timezone_offset   numeric(4,2) not null check (timezone_offset between -12 and 14),
  languages         text[] not null default '{}',
  format            text not null check (format in ('remote','in_person','hybrid')),
  city              text not null,
  availability      text[] not null default '{}', -- e.g. {'weekday_evening','weekend_morning'}
  max_mentees       int  not null default 3 check (max_mentees > 0)
);

-- Dataset A: mentees (source profiles a user selects)
create table if not exists mentees (
  id                 text primary key,             -- e.g. 'mentee-01'
  name               text not null,
  goal_summary       text not null,
  career_stage       text not null,
  industry           text not null,
  desired_min_years  int  not null default 0 check (desired_min_years >= 0),
  timezone_offset    numeric(4,2) not null check (timezone_offset between -12 and 14),
  languages          text[] not null default '{}',
  format             text not null check (format in ('remote','in_person','hybrid')),
  city               text not null,
  availability       text[] not null default '{}'
);

create table if not exists mentor_skills (
  mentor_id    text not null references mentors(id) on delete cascade,
  skill_id     int  not null references skills(id)  on delete cascade,
  proficiency  int  not null check (proficiency between 1 and 5),
  primary key (mentor_id, skill_id)
);

create table if not exists mentee_goal_skills (
  mentee_id  text not null references mentees(id) on delete cascade,
  skill_id   int  not null references skills(id)  on delete cascade,
  priority   int  not null check (priority between 1 and 3), -- 3 = must-have
  primary key (mentee_id, skill_id)
);

create index if not exists mentor_skills_skill_idx on mentor_skills(skill_id);
create index if not exists mentee_goal_skills_skill_idx on mentee_goal_skills(skill_id);

alter table app_users          enable row level security;
alter table skills             enable row level security;
alter table mentors            enable row level security;
alter table mentees            enable row level security;
alter table mentor_skills      enable row level security;
alter table mentee_goal_skills enable row level security;
