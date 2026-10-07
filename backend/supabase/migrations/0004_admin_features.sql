-- Admin features: knowledge-base management, feature settings, mentorship requests.

-- ---------------------------------------------------------------------------
-- 1) Knowledge base: the document content lives in Postgres (source of truth).
--    managed_by = 'repo'  : synced from backend/kb/*.md by `npm run ingest`
--    managed_by = 'admin' : created or edited in the admin UI (the CLI never touches these)
-- ---------------------------------------------------------------------------
alter table kb_documents
  add column if not exists content text,
  add column if not exists managed_by text not null default 'repo' check (managed_by in ('repo', 'admin')),
  add column if not exists chunk_count int not null default 0,
  add column if not exists ingested_at timestamptz,
  add column if not exists ingest_error text,
  add column if not exists updated_by uuid references app_users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2) Feature settings (admin-controlled)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references app_users(id) on delete set null
);
alter table app_settings enable row level security;

insert into app_settings (key, value) values ('mentorship_requests_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Mentorship requests
-- ---------------------------------------------------------------------------
create table if not exists mentorship_requests (
  id            uuid primary key default gen_random_uuid(),
  mentee_id     text not null references mentees(id) on delete cascade,
  mentor_id     text not null references mentors(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired', 'ended')),
  message       text check (message is null or char_length(message) <= 500),
  score         int check (score between 0 and 100),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  ended_at      timestamptz
);
alter table mentorship_requests enable row level security;

-- No duplicate open requests between the same pair.
create unique index if not exists mentorship_open_pair_idx
  on mentorship_requests(mentee_id, mentor_id) where status in ('pending', 'accepted');
-- One active mentor per student ("only one active mentor per cycle").
create unique index if not exists mentorship_one_active_mentor_idx
  on mentorship_requests(mentee_id) where status = 'accepted';
create index if not exists mentorship_mentor_status_idx on mentorship_requests(mentor_id, status);

-- Mentors may support at most four mentees ("Mentors may support a maximum of four mentees").
update mentors set max_mentees = 4 where max_mentees > 4;
alter table mentors drop constraint if exists mentors_max_mentees_check;
alter table mentors add constraint mentors_max_mentees_check check (max_mentees between 1 and 4);

-- Pending requests expire after seven days ("The mentor has seven days to accept or decline").
create or replace function expire_stale_mentorship_requests()
returns int
language sql
as $$
  with expired as (
    update mentorship_requests
       set status = 'expired', responded_at = now()
     where status = 'pending' and created_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::int from expired;
$$;

-- Accept atomically: lock the mentor so concurrent accepts can't exceed capacity,
-- then cancel the student's other pending requests. Raises a distinct code per failure.
create or replace function accept_mentorship(p_request_id uuid, p_mentor_id text)
returns jsonb
language plpgsql
as $$
declare
  v_req       mentorship_requests%rowtype;
  v_capacity  int;
  v_used      int;
  v_cancelled uuid[];
begin
  perform 1 from mentors where id = p_mentor_id for update;

  select * into v_req from mentorship_requests where id = p_request_id for update;
  if not found or v_req.mentor_id <> p_mentor_id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_req.status = 'pending' and v_req.created_at < now() - interval '7 days' then
    update mentorship_requests set status = 'expired', responded_at = now() where id = p_request_id;
    raise exception 'expired' using errcode = 'P0001';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'not_pending' using errcode = 'P0001';
  end if;
  if exists (select 1 from mentorship_requests where mentee_id = v_req.mentee_id and status = 'accepted') then
    raise exception 'already_has_mentor' using errcode = 'P0001';
  end if;

  select max_mentees into v_capacity from mentors where id = p_mentor_id;
  select count(*) into v_used from mentorship_requests where mentor_id = p_mentor_id and status = 'accepted';
  if v_used >= v_capacity then
    raise exception 'at_capacity' using errcode = 'P0001';
  end if;

  update mentorship_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  with cancelled as (
    update mentorship_requests
       set status = 'cancelled', responded_at = now()
     where mentee_id = v_req.mentee_id and status = 'pending' and id <> p_request_id
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_cancelled from cancelled;

  return jsonb_build_object('accepted', p_request_id, 'autoCancelled', to_jsonb(v_cancelled));
end;
$$;

revoke execute on function expire_stale_mentorship_requests() from public, anon, authenticated;
revoke execute on function accept_mentorship(uuid, text) from public, anon, authenticated;
grant execute on function expire_stale_mentorship_requests() to service_role;
grant execute on function accept_mentorship(uuid, text) to service_role;
