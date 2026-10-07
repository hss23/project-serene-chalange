-- Real user accounts with roles.
--   student = mentee (Dataset A), teacher = mentor (Dataset B), admin = manages users.
-- Postgres is the single source of truth for role and status; the backend enforces them.

alter table app_users
  add column if not exists role text check (role in ('student', 'teacher', 'admin')),   -- NULL = not chosen yet
  add column if not exists status text not null default 'active'
    check (status in ('active', 'pending', 'suspended')),
  add column if not exists is_demo boolean not null default false;

create index if not exists app_users_role_status_idx on app_users(role, status);

-- 1:1 link from a profile to the account that owns it.
alter table mentees add column if not exists user_id uuid unique references app_users(id) on delete cascade;
alter table mentors add column if not exists user_id uuid unique references app_users(id) on delete cascade;

-- Ids for profiles created through the app (seed rows keep their readable ids).
alter table mentees alter column id set default ('mentee-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8));
alter table mentors alter column id set default ('mentor-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8));

-- Save a student's profile and goal skills atomically (one transaction).
create or replace function save_mentee_profile(p_user_id uuid, p_profile jsonb, p_goals jsonb)
returns text
language plpgsql
as $$
declare
  v_id text;
begin
  insert into mentees (user_id, name, goal_summary, career_stage, industry, desired_min_years,
                       timezone_offset, languages, format, city, availability)
  values (
    p_user_id,
    p_profile->>'name',
    p_profile->>'goal_summary',
    p_profile->>'career_stage',
    p_profile->>'industry',
    (p_profile->>'desired_min_years')::int,
    (p_profile->>'timezone_offset')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_profile->'languages', '[]'::jsonb))),
    p_profile->>'format',
    p_profile->>'city',
    array(select jsonb_array_elements_text(coalesce(p_profile->'availability', '[]'::jsonb)))
  )
  on conflict (user_id) do update set
    name = excluded.name,
    goal_summary = excluded.goal_summary,
    career_stage = excluded.career_stage,
    industry = excluded.industry,
    desired_min_years = excluded.desired_min_years,
    timezone_offset = excluded.timezone_offset,
    languages = excluded.languages,
    format = excluded.format,
    city = excluded.city,
    availability = excluded.availability
  returning id into v_id;

  delete from mentee_goal_skills where mentee_id = v_id;
  insert into mentee_goal_skills (mentee_id, skill_id, priority)
  select v_id, s.id, (g->>'priority')::int
  from jsonb_array_elements(coalesce(p_goals, '[]'::jsonb)) g
  join skills s on s.name = g->>'name'
  on conflict do nothing;

  return v_id;
end;
$$;

-- Save a teacher's profile and skills atomically (one transaction).
create or replace function save_mentor_profile(p_user_id uuid, p_profile jsonb, p_skills jsonb)
returns text
language plpgsql
as $$
declare
  v_id text;
begin
  insert into mentors (user_id, name, headline, bio, industry, years_experience, timezone_offset,
                       languages, format, city, availability, max_mentees)
  values (
    p_user_id,
    p_profile->>'name',
    p_profile->>'headline',
    p_profile->>'bio',
    p_profile->>'industry',
    (p_profile->>'years_experience')::int,
    (p_profile->>'timezone_offset')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_profile->'languages', '[]'::jsonb))),
    p_profile->>'format',
    p_profile->>'city',
    array(select jsonb_array_elements_text(coalesce(p_profile->'availability', '[]'::jsonb))),
    coalesce((p_profile->>'max_mentees')::int, 3)
  )
  on conflict (user_id) do update set
    name = excluded.name,
    headline = excluded.headline,
    bio = excluded.bio,
    industry = excluded.industry,
    years_experience = excluded.years_experience,
    timezone_offset = excluded.timezone_offset,
    languages = excluded.languages,
    format = excluded.format,
    city = excluded.city,
    availability = excluded.availability,
    max_mentees = excluded.max_mentees
  returning id into v_id;

  delete from mentor_skills where mentor_id = v_id;
  insert into mentor_skills (mentor_id, skill_id, proficiency)
  select v_id, s.id, (k->>'proficiency')::int
  from jsonb_array_elements(coalesce(p_skills, '[]'::jsonb)) k
  join skills s on s.name = k->>'name'
  on conflict do nothing;

  return v_id;
end;
$$;

revoke execute on function save_mentee_profile(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function save_mentor_profile(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function save_mentee_profile(uuid, jsonb, jsonb) to service_role;
grant execute on function save_mentor_profile(uuid, jsonb, jsonb) to service_role;
