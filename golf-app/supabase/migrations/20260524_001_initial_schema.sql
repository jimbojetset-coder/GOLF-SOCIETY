-- ============================================================
-- Golf Society — Full Database Migration
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- ============================================================

-- ============================================================
-- IDEMPOTENT CLEANUP  (safe to re-run)
-- ============================================================
drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
drop trigger if exists trg_competitions_updated_at on public.competitions;
drop trigger if exists trg_matches_updated_at on public.matches;
drop trigger if exists trg_match_scores_updated_at on public.match_scores;
drop trigger if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.join_competition(text) cascade;

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "pgcrypto";


-- ============================================================
-- 1. USER PROFILES
-- ============================================================
create table if not exists public.user_profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  display_name     text,
  avatar_url       text,
  home_course      text,
  handicap_index   numeric(4,1),
  rounds_submitted integer not null default 0,
  scoring_layout   text not null default 'card'   -- 'card' | 'grid' | 'compact'
                     check (scoring_layout in ('card','grid','compact')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint user_profiles_user_id_key unique (user_id)
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);


-- ============================================================
-- 2. COURSES
-- ============================================================
create table if not exists public.courses (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  location            text,
  holes_count         integer not null default 18,
  created_by_user_id  uuid references auth.users(id) on delete set null,
  is_verified         boolean not null default false,
  source              text not null default 'manual'  -- 'manual' | 'ocr' | 'imported'
                        check (source in ('manual','ocr','imported')),
  created_at          timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "Courses are readable by all authenticated users"
  on public.courses for select
  using (auth.role() = 'authenticated');

create policy "Any authenticated user can create a course"
  on public.courses for insert
  with check (auth.role() = 'authenticated');

create policy "Creators can update their courses"
  on public.courses for update
  using (auth.uid() = created_by_user_id);


-- ============================================================
-- 3. COURSE TEES
-- ============================================================
create table if not exists public.course_tees (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses(id) on delete cascade,
  tee_name       text not null,
  tee_colour     text,
  course_rating  numeric(4,1),
  slope_rating   integer,
  total_yards    integer,
  total_par      integer not null default 72
);

alter table public.course_tees enable row level security;

create policy "Tees readable by all authenticated users"
  on public.course_tees for select
  using (auth.role() = 'authenticated');

create policy "Any authenticated user can create tees"
  on public.course_tees for insert
  with check (auth.role() = 'authenticated');

create policy "Any authenticated user can update tees"
  on public.course_tees for update
  using (auth.role() = 'authenticated');


-- ============================================================
-- 4. COURSE HOLES
-- ============================================================
create table if not exists public.course_holes (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  tee_id       uuid not null references public.course_tees(id) on delete cascade,
  hole_number  integer not null check (hole_number between 1 and 18),
  par          integer not null check (par between 3 and 6),
  stroke_index integer check (stroke_index between 1 and 18),
  yards        integer,
  constraint course_holes_unique unique (tee_id, hole_number)
);

alter table public.course_holes enable row level security;

create policy "Holes readable by all authenticated users"
  on public.course_holes for select
  using (auth.role() = 'authenticated');

create policy "Any authenticated user can create holes"
  on public.course_holes for insert
  with check (auth.role() = 'authenticated');

create policy "Any authenticated user can update holes"
  on public.course_holes for update
  using (auth.role() = 'authenticated');


-- ============================================================
-- 5. COMPETITIONS
-- ============================================================
create table if not exists public.competitions (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  start_date            date,
  end_date              date,
  event_date            date,                    -- legacy compat
  course_id             uuid references public.courses(id) on delete set null,
  tee_id                uuid references public.course_tees(id) on delete set null,
  status                text not null default 'active'
                          check (status in ('active','closed','history')),
  created_by_user_id    uuid references auth.users(id) on delete set null,
  share_token           text unique default encode(gen_random_bytes(12), 'hex'),
  hero_image_url        text,
  team_a_name           text not null default 'Team A',
  team_a_colour         text not null default '#16A34A',
  team_b_name           text not null default 'Team B',
  team_b_colour         text not null default '#2563EB',
  team_a_points         numeric(5,1) not null default 0,
  team_b_points         numeric(5,1) not null default 0,
  hide_leaderboard      boolean not null default false,
  hide_last_n_results   integer not null default 0,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.competitions enable row level security;

-- Anyone who is a member (or the creator) can read the competition
create policy "Competition members can read"
  on public.competitions for select
  using (
    auth.uid() = created_by_user_id
    or exists (
      select 1 from public.competition_members cm
      where cm.competition_id = id
        and cm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create competitions"
  on public.competitions for insert
  with check (auth.role() = 'authenticated');

create policy "Creator can update competition"
  on public.competitions for update
  using (auth.uid() = created_by_user_id);


-- ============================================================
-- 6. COMPETITION MEMBERS  (access control / RLS gate)
-- ============================================================
create table if not exists public.competition_members (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'spectator'
                    check (role in ('spectator','scorer','owner')),
  joined_at       timestamptz not null default now(),
  constraint competition_members_unique unique (competition_id, user_id)
);

alter table public.competition_members enable row level security;

create policy "Members can read own membership"
  on public.competition_members for select
  using (auth.uid() = user_id);

create policy "Anyone authenticated can insert own membership"
  on public.competition_members for insert
  with check (auth.uid() = user_id);

create policy "Member can delete own membership"
  on public.competition_members for delete
  using (auth.uid() = user_id);


-- ============================================================
-- 7. PLAYERS
-- ============================================================
create table if not exists public.players (
  id                uuid primary key default gen_random_uuid(),
  competition_id    uuid not null references public.competitions(id) on delete cascade,
  name              text not null,
  photo_url         text,
  handicap_index    numeric(4,1),
  playing_handicap  integer,
  team              text check (team in ('A','B')),
  user_id           uuid references auth.users(id) on delete set null,  -- null = ghost player
  is_ghost          boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.players enable row level security;

create policy "Competition members can read players"
  on public.players for select
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = players.competition_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.competitions c
      where c.id = players.competition_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Competition creator can insert players"
  on public.players for insert
  with check (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Competition creator can update players"
  on public.players for update
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and c.created_by_user_id = auth.uid()
    )
  );

-- Ghost player claim policy: run separately after table creation (see Part 2)


-- ============================================================
-- 8. MATCHES
-- ============================================================
create table if not exists public.matches (
  id                   uuid primary key default gen_random_uuid(),
  competition_id       uuid not null references public.competitions(id) on delete cascade,
  match_number         integer,
  format               text not null default 'fourball'
                         check (format in ('fourball','foursomes','singles','scramble')),
  session_date         date,
  session              text check (session in ('morning','afternoon','evening')),
  status               text not null default 'pending'
                         check (status in ('pending','in_progress','complete')),
  result               text,                     -- e.g. "3&2", "1UP", "A/S"
  winning_team         text check (winning_team in ('A','B','halved')),
  points_a             numeric(3,1) not null default 0,
  points_b             numeric(3,1) not null default 0,
  holes_played         integer not null default 0,
  scorer_user_id       uuid references auth.users(id) on delete set null,
  scorer_share_token   text unique default encode(gen_random_bytes(8), 'hex'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.matches enable row level security;

create policy "Competition members can read matches"
  on public.matches for select
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = matches.competition_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.competitions c
      where c.id = matches.competition_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Competition creator can insert/update matches"
  on public.matches for insert
  with check (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Scorer or creator can update matches"
  on public.matches for update
  using (
    auth.uid() = scorer_user_id
    or exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and c.created_by_user_id = auth.uid()
    )
  );


-- ============================================================
-- 9. MATCH PLAYERS  (who plays in each match + handicap)
-- ============================================================
create table if not exists public.match_players (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches(id) on delete cascade,
  player_id         uuid not null references public.players(id) on delete cascade,
  team              text not null check (team in ('A','B')),
  playing_handicap  integer,
  strokes_received  integer not null default 0,
  constraint match_players_unique unique (match_id, player_id)
);

alter table public.match_players enable row level security;

create policy "Competition members can read match players"
  on public.match_players for select
  using (
    exists (
      select 1 from public.matches m
      join public.competition_members cm on cm.competition_id = m.competition_id
      where m.id = match_players.match_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.matches m
      join public.competitions c on c.id = m.competition_id
      where m.id = match_players.match_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Creator can insert match players"
  on public.match_players for insert
  with check (
    exists (
      select 1 from public.matches m
      join public.competitions c on c.id = m.competition_id
      where m.id = match_id
        and c.created_by_user_id = auth.uid()
    )
  );


-- ============================================================
-- 10. MATCH SCORES  (hole-by-hole)
-- ============================================================
create table if not exists public.match_scores (
  id                  uuid primary key default gen_random_uuid(),
  match_id            uuid not null references public.matches(id) on delete cascade,
  hole_number         integer not null check (hole_number between 1 and 18),
  par                 integer not null check (par between 3 and 6),
  stroke_index        integer,
  score_a             integer,
  score_b             integer,
  score_a_player2     integer,    -- Foursomes/Fourball second player
  score_b_player2     integer,
  net_score_a         integer,
  net_score_b         integer,
  hole_result         text check (hole_result in ('A','B','halved')),
  match_status_after  text,       -- e.g. "A2", "B1", "AS"
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint match_scores_unique unique (match_id, hole_number)
);

alter table public.match_scores enable row level security;

create policy "Competition members can read scores"
  on public.match_scores for select
  using (
    exists (
      select 1 from public.matches m
      join public.competition_members cm on cm.competition_id = m.competition_id
      where m.id = match_scores.match_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.matches m
      join public.competitions c on c.id = m.competition_id
      where m.id = match_scores.match_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Scorer or creator can upsert scores"
  on public.match_scores for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.scorer_user_id = auth.uid()
          or exists (
            select 1 from public.competitions c
            where c.id = m.competition_id
              and c.created_by_user_id = auth.uid()
          ))
    )
  );

create policy "Scorer or creator can update scores"
  on public.match_scores for update
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.scorer_user_id = auth.uid()
          or exists (
            select 1 from public.competitions c
            where c.id = m.competition_id
              and c.created_by_user_id = auth.uid()
          ))
    )
  );


-- ============================================================
-- 11. HIGHLIGHT EVENTS
-- ============================================================
create table if not exists public.highlight_events (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  match_id        uuid references public.matches(id) on delete cascade,
  player_id       uuid references public.players(id) on delete set null,
  hole_number     integer,
  event_type      text not null
                    check (event_type in ('birdie','eagle','albatross','hole_in_one','par')),
  team            text check (team in ('A','B')),
  timestamp       timestamptz not null default now()
);

alter table public.highlight_events enable row level security;

create policy "Competition members can read highlights"
  on public.highlight_events for select
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = highlight_events.competition_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.competitions c
      where c.id = highlight_events.competition_id
        and c.created_by_user_id = auth.uid()
    )
  );

create policy "Scorer or creator can insert highlights"
  on public.highlight_events for insert
  with check (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and (c.created_by_user_id = auth.uid()
          or exists (
            select 1 from public.matches m
            where m.competition_id = c.id
              and m.scorer_user_id = auth.uid()
          ))
    )
  );


-- ============================================================
-- 12. SCORECARD SCANS  (OCR pipeline)
-- ============================================================
create table if not exists public.scorecard_scans (
  id                  uuid primary key default gen_random_uuid(),
  image_url           text not null,
  status              text not null default 'pending'
                        check (status in ('pending','processing','complete','error')),
  extracted_data      jsonb,
  course_id           uuid references public.courses(id) on delete set null,
  error_message       text,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

alter table public.scorecard_scans enable row level security;

create policy "Users can read own scans"
  on public.scorecard_scans for select
  using (auth.uid() = uploaded_by_user_id);

create policy "Users can insert own scans"
  on public.scorecard_scans for insert
  with check (auth.uid() = uploaded_by_user_id);

create policy "Users can update own scans"
  on public.scorecard_scans for update
  using (auth.uid() = uploaded_by_user_id);


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on any row change
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();

create trigger trg_competitions_updated_at
  before update on public.competitions
  for each row execute function public.handle_updated_at();

create trigger trg_matches_updated_at
  before update on public.matches
  for each row execute function public.handle_updated_at();

create trigger trg_match_scores_updated_at
  before update on public.match_scores
  for each row execute function public.handle_updated_at();


-- Auto-create a user_profile row on first sign-in
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- join_competition RPC
-- Called by the client after receiving a share token link.
-- Adds the calling user to competition_members as 'spectator'.
-- Returns competition_id + competition_name on success,
-- or an error string if the token is invalid.
-- ============================================================
create or replace function public.join_competition(p_share_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_competition competitions%rowtype;
begin
  -- Look up by competition share token
  select * into v_competition
  from public.competitions
  where share_token = p_share_token
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Invalid or expired share link');
  end if;

  -- Upsert membership (do nothing if already a member)
  insert into public.competition_members (competition_id, user_id, role)
  values (v_competition.id, auth.uid(), 'spectator')
  on conflict (competition_id, user_id) do nothing;

  return jsonb_build_object(
    'competition_id',   v_competition.id,
    'competition_name', v_competition.name
  );
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.join_competition(text) to authenticated;


-- ============================================================
-- STORAGE BUCKETS
-- Run these in the Supabase Dashboard → Storage, OR via CLI:
--   supabase storage create player-photos --public
--   supabase storage create competition-heroes --public
--   supabase storage create scorecards --public
-- ============================================================

-- Note: storage bucket creation via SQL requires the storage extension.
-- If the insert fails, create buckets manually in Dashboard → Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('player-photos',       'player-photos',       true, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('competition-heroes',  'competition-heroes',  true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('scorecards',          'scorecards',          true, 15728640, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

-- Storage RLS — allow any authenticated user to upload/read
insert into storage.policies (name, bucket_id, definition)
values
  ('player-photos read',       'player-photos',       '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::player-photos/*"}]}'),
  ('competition-heroes read',  'competition-heroes',  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::competition-heroes/*"}]}'),
  ('scorecards read',          'scorecards',          '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::scorecards/*"}]}')
on conflict do nothing;


-- ============================================================
-- INDEXES  (performance)
-- ============================================================
create index if not exists idx_competitions_status          on public.competitions(status);
create index if not exists idx_competitions_share_token     on public.competitions(share_token);
create index if not exists idx_competition_members_user     on public.competition_members(user_id);
create index if not exists idx_competition_members_comp     on public.competition_members(competition_id);
create index if not exists idx_matches_competition          on public.matches(competition_id);
create index if not exists idx_matches_session_date         on public.matches(session_date);
create index if not exists idx_match_scores_match           on public.match_scores(match_id);
create index if not exists idx_players_competition          on public.players(competition_id);
create index if not exists idx_players_user                 on public.players(user_id);
create index if not exists idx_highlight_events_competition on public.highlight_events(competition_id);
create index if not exists idx_highlight_events_match       on public.highlight_events(match_id);


-- ============================================================
-- DONE
-- ============================================================
-- Tables created: user_profiles, courses, course_tees, course_holes,
--                 competitions, competition_members, players, matches,
--                 match_players, match_scores, highlight_events, scorecard_scans
-- Functions:      handle_updated_at, handle_new_user, join_competition
-- Storage:        player-photos, competition-heroes, scorecards
-- ============================================================
