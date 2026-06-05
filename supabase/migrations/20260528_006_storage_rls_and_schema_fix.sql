-- ============================================================
-- Golf Society — Schema + Storage RLS fixes
-- Safe to re-run. Paste into Supabase Dashboard → SQL Editor → Run.
-- Fixes:
--   2) "new row violates row-level security policy" on photo uploads
--   7) "Could not find the 'hide_last_n_results' column of 'competitions'"
-- ============================================================

-- ── 1. Make sure competitions has every column the app expects ─
alter table public.competitions
  add column if not exists hide_last_n_results integer not null default 0;

alter table public.competitions
  add column if not exists handicap_allowance numeric(4,2) not null default 0.90;

alter table public.competitions
  add column if not exists hide_leaderboard boolean not null default false;

alter table public.competitions
  add column if not exists hero_image_url text;

alter table public.competitions
  add column if not exists notes text;

-- ── 2. Make sure the storage buckets exist ─────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('player-photos',       'player-photos',       true, 5242880,  array['image/jpeg','image/png','image/webp']),
  ('competition-heroes',  'competition-heroes',  true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('scorecards',          'scorecards',          true, 15728640, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 3. Drop any old policies so we can re-create cleanly ───────
drop policy if exists "Authenticated users can upload player photos"  on storage.objects;
drop policy if exists "Anyone can read player photos"                  on storage.objects;
drop policy if exists "Authenticated users can update player photos"   on storage.objects;
drop policy if exists "Authenticated users can delete player photos"   on storage.objects;

drop policy if exists "Authenticated users can upload hero images"     on storage.objects;
drop policy if exists "Anyone can read hero images"                    on storage.objects;
drop policy if exists "Authenticated users can update hero images"     on storage.objects;
drop policy if exists "Authenticated users can delete hero images"     on storage.objects;

drop policy if exists "Authenticated users can upload scorecards"      on storage.objects;
drop policy if exists "Anyone can read scorecards"                     on storage.objects;
drop policy if exists "Authenticated users can update scorecards"      on storage.objects;
drop policy if exists "Authenticated users can delete scorecards"      on storage.objects;

-- ── 4. Create storage.objects RLS policies (one per bucket × verb) ─

-- player-photos
create policy "Authenticated users can upload player photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos');

create policy "Anyone can read player photos"
  on storage.objects for select to public
  using (bucket_id = 'player-photos');

create policy "Authenticated users can update player photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'player-photos');

create policy "Authenticated users can delete player photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos');

-- competition-heroes
create policy "Authenticated users can upload hero images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'competition-heroes');

create policy "Anyone can read hero images"
  on storage.objects for select to public
  using (bucket_id = 'competition-heroes');

create policy "Authenticated users can update hero images"
  on storage.objects for update to authenticated
  using (bucket_id = 'competition-heroes');

create policy "Authenticated users can delete hero images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'competition-heroes');

-- scorecards
create policy "Authenticated users can upload scorecards"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'scorecards');

create policy "Anyone can read scorecards"
  on storage.objects for select to public
  using (bucket_id = 'scorecards');

create policy "Authenticated users can update scorecards"
  on storage.objects for update to authenticated
  using (bucket_id = 'scorecards');

create policy "Authenticated users can delete scorecards"
  on storage.objects for delete to authenticated
  using (bucket_id = 'scorecards');

-- ── 5. Force the Postgres schema cache to refresh so the app sees
--     the newly-added columns immediately.
notify pgrst, 'reload schema';

-- ============================================================
-- DONE
-- ============================================================
