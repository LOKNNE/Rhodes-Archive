-- Rhodes Archive Cloud Sync
-- Run this once in Supabase SQL Editor.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- The Data API checks table privileges before applying RLS.
-- Keep anonymous users out, but allow signed-in users to use the sync table.
revoke all on table public.user_state from anon;
grant select, insert, update on table public.user_state to authenticated;

create policy "Users can read their own Rhodes state"
on public.user_state
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own Rhodes state"
on public.user_state
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own Rhodes state"
on public.user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
