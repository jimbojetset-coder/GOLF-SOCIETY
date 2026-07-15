-- ============================================================
-- Migration 003 — scorecard_scans table
-- Required by the scanScorecard utility in src/utils/scanScorecard.ts
-- ============================================================

create table if not exists public.scorecard_scans (
  id                    uuid primary key default gen_random_uuid(),
  image_url             text not null,
  status                text not null default 'pending'
                          check (status in ('pending', 'processing', 'complete', 'error')),
  extracted_data        jsonb,
  error_message         text,
  uploaded_by_user_id   uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.scorecard_scans enable row level security;

create policy "Users can view their own scans"
  on public.scorecard_scans for select
  using (uploaded_by_user_id = auth.uid());

create policy "Authenticated users can insert scans"
  on public.scorecard_scans for insert
  with check (auth.uid() is not null);

create policy "Users can update their own scans"
  on public.scorecard_scans for update
  using (uploaded_by_user_id = auth.uid());

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_updated_at_scorecard_scans'
  ) then
    create trigger set_updated_at_scorecard_scans
      before update on public.scorecard_scans
      for each row execute function public.handle_updated_at();
  end if;
end $$;
