-- Rhodes Archive Cloud Sync
-- Run this once in Supabase SQL Editor.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "Users can read their own Rhodes state"
on public.user_state
for select
using (auth.uid() = user_id);

create policy "Users can insert their own Rhodes state"
on public.user_state
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own Rhodes state"
on public.user_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
