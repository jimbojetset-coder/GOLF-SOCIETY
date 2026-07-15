-- ============================================================
-- Migration: Add handicap_allowance to competitions
-- ============================================================

alter table public.competitions
  add column if not exists handicap_allowance numeric(4,2) not null default 0.90;
