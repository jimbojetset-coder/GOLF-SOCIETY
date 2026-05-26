-- ============================================================
-- Migration 002 — Missing tables, RPCs, policies, constraints
-- ============================================================

-- ── 1. round_results table ───────────────────────────────────
create table if not exists public.round_results (
  id                      uuid primary key default gen_random_uuid(),
  competition_id          uuid references public.competitions(id) on delete cascade,
  player_id               uuid references public.players(id) on delete cascade,
  match_id                uuid references public.matches(id) on delete set null,
  gross_score             integer,
  net_score               integer,
  stableford_points       integer,
  holes_played            integer not null default 18,
  score_differential      numeric(5,2),
  handicap_before         numeric(4,1),
  handicap_suggested      numeric(4,1),
  handicap_adjustment_note text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.round_results enable row level security;

create policy "Members can view round results"
  on public.round_results for select
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = round_results.competition_id
        and cm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can insert round results"
  on public.round_results for insert
  with check (auth.uid() is not null);

-- ── 2. claim_ghost_player RPC ────────────────────────────────
create or replace function public.claim_ghost_player(
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_player public.players%rowtype;
begin
  -- Fetch the player
  select * into v_player from public.players where id = p_player_id;

  if not found then
    return jsonb_build_object('error', 'Player not found');
  end if;

  if v_player.user_id is not null then
    return jsonb_build_object('error', 'Player already claimed');
  end if;

  -- Link the player to the current user
  update public.players
  set user_id = auth.uid()
  where id = p_player_id
    and user_id is null;

  -- Add user to competition_members if not already there
  insert into public.competition_members (competition_id, user_id, role)
  values (v_player.competition_id, auth.uid(), 'spectator')
  on conflict (competition_id, user_id) do nothing;

  return jsonb_build_object('success', true, 'player_id', p_player_id);
end;
$$;

-- ── 3. increment_competition_points RPC ─────────────────────
create or replace function public.increment_competition_points(
  comp_id uuid,
  delta_a numeric,
  delta_b numeric
)
returns void
language plpgsql
security definer
as $$
begin
  update public.competitions
  set
    team_a_points = coalesce(team_a_points, 0) + delta_a,
    team_b_points = coalesce(team_b_points, 0) + delta_b
  where id = comp_id;
end;
$$;

-- ── 4. Missing RLS policies ──────────────────────────────────

-- courses: allow creators to delete
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'courses' and policyname = 'Creators can delete courses'
  ) then
    execute 'create policy "Creators can delete courses"
      on public.courses for delete
      using (created_by_user_id = auth.uid())';
  end if;
end $$;

-- players: allow creators to delete
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'players' and policyname = 'Creators can delete players'
  ) then
    execute 'create policy "Creators can delete players"
      on public.players for delete
      using (
        exists (
          select 1 from public.competitions c
          where c.id = players.competition_id
            and c.created_by_user_id = auth.uid()
        )
      )';
  end if;
end $$;

-- match_players: allow update and delete for competition creators
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_players' and policyname = 'Creators can update match_players'
  ) then
    execute 'create policy "Creators can update match_players"
      on public.match_players for update
      using (
        exists (
          select 1 from public.matches m
          join public.competitions c on c.id = m.competition_id
          where m.id = match_players.match_id
            and c.created_by_user_id = auth.uid()
        )
      )';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_players' and policyname = 'Creators can delete match_players'
  ) then
    execute 'create policy "Creators can delete match_players"
      on public.match_players for delete
      using (
        exists (
          select 1 from public.matches m
          join public.competitions c on c.id = m.competition_id
          where m.id = match_players.match_id
            and c.created_by_user_id = auth.uid()
        )
      )';
  end if;
end $$;

-- ── 5. Unique constraint on course_tees ──────────────────────
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'course_tees_course_id_tee_name_key'
  ) then
    alter table public.course_tees
      add constraint course_tees_course_id_tee_name_key unique (course_id, tee_name);
  end if;
end $$;

-- ── 6. updated_at trigger for round_results ──────────────────
do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_at_round_results'
  ) then
    create trigger set_updated_at_round_results
      before update on public.round_results
      for each row execute function public.handle_updated_at();
  end if;
end $$;
