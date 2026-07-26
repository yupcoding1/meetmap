create extension if not exists postgis;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  bio text,
  interests text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete cascade not null,
  venue_name text not null,
  venue_place_id text,
  latitude double precision,
  longitude double precision,
  activity_type text not null,
  scheduled_at timestamptz not null,
  spots_total int not null default 4,
  spots_filled int not null default 1,
  description text,
  status text not null default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending',
  requested_at timestamptz default now(),
  approved_at timestamptz,
  unique (plan_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_viewable" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "plans_read" on public.plans;
drop policy if exists "plans_insert" on public.plans;
drop policy if exists "plans_update" on public.plans;
drop policy if exists "plan_participants_read" on public.plan_participants;
drop policy if exists "plan_participants_insert" on public.plan_participants;
drop policy if exists "messages_read" on public.messages;
drop policy if exists "messages_insert" on public.messages;

create policy "profiles_viewable" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "plans_read" on public.plans for select using (true);
create policy "plans_insert" on public.plans for insert with check (auth.uid() = creator_id);
create policy "plans_update" on public.plans for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

create policy "plan_participants_read" on public.plan_participants for select using (true);
create policy "plan_participants_insert" on public.plan_participants for insert with check (auth.uid() = user_id);

create policy "messages_read" on public.messages for select using (true);
create policy "messages_insert" on public.messages for insert with check (auth.uid() = sender_id);
