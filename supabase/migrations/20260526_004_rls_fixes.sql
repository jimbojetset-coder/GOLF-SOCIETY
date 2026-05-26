-- ============================================================
-- Migration 004 — RLS security fixes
-- ============================================================

-- ── 1. course_tees UPDATE: restrict to course creator ────────
--    (previously allowed any authenticated user to update any tee)
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_tees'
      and policyname = 'Any authenticated user can update tees'
  ) then
    drop policy "Any authenticated user can update tees" on public.course_tees;
  end if;
end $$;

create policy "Course creator can update tees"
  on public.course_tees for update
  using (
    exists (
      select 1 from public.courses
      where id = course_tees.course_id
        and created_by_user_id = auth.uid()
    )
  );


-- ── 2. course_holes UPDATE: restrict to course creator ───────
--    (previously allowed any authenticated user to update any hole)
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_holes'
      and policyname = 'Any authenticated user can update holes'
  ) then
    drop policy "Any authenticated user can update holes" on public.course_holes;
  end if;
end $$;

create policy "Course creator can update holes"
  on public.course_holes for update
  using (
    exists (
      select 1 from public.courses
      where id = course_holes.course_id
        and created_by_user_id = auth.uid()
    )
  );


-- ── 3. course_tees INSERT: restrict to course creator ────────
--    (previously allowed any authenticated user to add tees to any course)
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_tees'
      and policyname = 'Any authenticated user can create tees'
  ) then
    drop policy "Any authenticated user can create tees" on public.course_tees;
  end if;
end $$;

create policy "Course creator can insert tees"
  on public.course_tees for insert
  with check (
    exists (
      select 1 from public.courses
      where id = course_tees.course_id
        and created_by_user_id = auth.uid()
    )
  );


-- ── 4. course_holes INSERT: restrict to course creator ───────
--    (previously allowed any authenticated user to add holes to any course)
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_holes'
      and policyname = 'Any authenticated user can create holes'
  ) then
    drop policy "Any authenticated user can create holes" on public.course_holes;
  end if;
end $$;

create policy "Course creator can insert holes"
  on public.course_holes for insert
  with check (
    exists (
      select 1 from public.courses
      where id = course_holes.course_id
        and created_by_user_id = auth.uid()
    )
  );


-- ── 5. round_results INSERT: require competition membership ──
--    (previously allowed any authenticated user to insert into any competition)
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_results'
      and policyname = 'Authenticated users can insert round results'
  ) then
    drop policy "Authenticated users can insert round results" on public.round_results;
  end if;
end $$;

create policy "Members or creator can insert round results"
  on public.round_results for insert
  with check (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and (
          c.created_by_user_id = auth.uid()
          or exists (
            select 1 from public.competition_members cm
            where cm.competition_id = c.id
              and cm.user_id = auth.uid()
          )
        )
    )
  );


-- ── 6. round_results SELECT: add creator OR clause ───────────
--    (previously creator could not read results from their own competition)
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'round_results'
      and policyname = 'Members can view round results'
  ) then
    drop policy "Members can view round results" on public.round_results;
  end if;
end $$;

create policy "Members or creator can view round results"
  on public.round_results for select
  using (
    exists (
      select 1 from public.competition_members cm
      where cm.competition_id = round_results.competition_id
        and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from public.competitions c
      where c.id = round_results.competition_id
        and c.created_by_user_id = auth.uid()
    )
  );


-- ── 7. highlight_events: unique constraint for upsert ────────
--    (without this, supabase upsert with onConflict throws an error)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'highlight_events_match_player_hole_unique'
  ) then
    alter table public.highlight_events
      add constraint highlight_events_match_player_hole_unique
        unique (match_id, player_id, hole_number);
  end if;
end $$;


-- ── 8. highlight_events UPDATE policy ────────────────────────
--    (upsert update path was blocked — no UPDATE policy existed)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'highlight_events'
      and policyname = 'Scorer or creator can update highlights'
  ) then
    execute $policy$
      create policy "Scorer or creator can update highlights"
        on public.highlight_events for update
        using (
          exists (
            select 1 from public.competitions c
            where c.id = highlight_events.competition_id
              and (
                c.created_by_user_id = auth.uid()
                or exists (
                  select 1 from public.matches m
                  where m.competition_id = c.id
                    and m.scorer_user_id = auth.uid()
                )
              )
          )
        )
    $policy$;
  end if;
end $$;


-- ── 9. highlight_events DELETE policy ───────────────────────
--    (scorer or creator can remove an incorrectly entered highlight)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'highlight_events'
      and policyname = 'Scorer or creator can delete highlights'
  ) then
    execute $policy$
      create policy "Scorer or creator can delete highlights"
        on public.highlight_events for delete
        using (
          exists (
            select 1 from public.competitions c
            where c.id = highlight_events.competition_id
              and (
                c.created_by_user_id = auth.uid()
                or exists (
                  select 1 from public.matches m
                  where m.competition_id = c.id
                    and m.scorer_user_id = auth.uid()
                )
              )
          )
        )
    $policy$;
  end if;
end $$;


-- ── 10. competition_members: creator can enumerate members ───
--    (creator previously had no way to list who had joined)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'competition_members'
      and policyname = 'Creator can read all members of their competition'
  ) then
    execute $policy$
      create policy "Creator can read all members of their competition"
        on public.competition_members for select
        using (
          exists (
            select 1 from public.competitions c
            where c.id = competition_members.competition_id
              and c.created_by_user_id = auth.uid()
          )
        )
    $policy$;
  end if;
end $$;
