# MeetMap Setup Guide

## Step 1: Supabase Project Setup

### 1.1 Create Supabase Project
1. Go to https://supabase.com
2. Sign up with GitHub or email
3. Click "New Project"
4. Enter:
   - **Project name**: meetmap
   - **Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your location
5. Click "Create new project" (takes ~2 minutes)

### 1.2 Enable PostGIS Extension
Once project loads:
1. Go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Paste this SQL:
```sql
-- Enable PostGIS for geospatial queries
create extension if not exists postgis;
create extension if not exists postgis_raster;

-- Verify installation
select postgis_version();
```
4. Click "Run" → You should see the PostGIS version

### 1.3 Get Your Credentials
1. Go to **Project Settings** (bottom left)
2. Click **API** tab
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** → Save for later (backend operations)

---

## Step 2: Google Cloud Project Setup

### 2.1 Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Sign in with Google account
3. Click project dropdown (top-left) → "New Project"
4. **Project name**: MeetMap
5. Click **Create**
6. Once created, select it from the dropdown

### 2.2 Enable Required APIs
1. Go to **APIs & Services** → **Library**
2. Search and **ENABLE** these:
   - **Maps JavaScript API**
   - **Places API**
   - **Geolocation API**

### 2.3 Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **API Key**
3. Copy the key value
4. Click **Edit API Key** → **Restrict Key**:
   - **Application restrictions**: Select "HTTP referrers (websites)"
   - **Website restrictions**: Add your domain (use `localhost:3000` for now)
   - **API restrictions**: Select **Restrict key** → Select the 3 APIs above
5. Save

**Your Google Maps API Key** → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### 2.4 Enable Billing (Free $200 Credit)
1. Go to **Billing** (left sidebar)
2. Click **Link Billing Account**
3. Create a billing account → Add payment method
   - You won't be charged until you exceed $200/month
   - At MVP scale with ~1,000 users, you'll use maybe $10-30/month

---

## Step 3: Create `.env.local` File

In the `meetmap` folder, create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-api-key-here
```

⚠️ **NEVER commit `.env.local` to git** — add it to `.gitignore` (already done)

---

## Step 4: Create Database Schema

Once npm finishes installing and you've got credentials in `.env.local`:

1. Open VS Code in the `meetmap` folder
2. Go to Supabase dashboard → **SQL Editor**
3. Create a new query and paste the complete schema below
4. Run it

### Complete Database Schema

```sql
-- Enable extensions
create extension if not exists postgis;

-- ============ PROFILES TABLE ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  bio text,
  interests text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============ PLANS TABLE ============
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete cascade not null,
  venue_name text not null,
  venue_place_id text,  -- Google Places ID for re-fetching details
  location geography(Point, 4326) not null,  -- PostGIS: latitude/longitude
  activity_type text not null,  -- 'gaming', 'coffee', 'study', 'sports', etc.
  scheduled_at timestamptz not null,
  spots_total int not null default 4,
  spots_filled int not null default 1,  -- creator counts as 1
  description text,
  status text not null default 'open',  -- open | full | cancelled | completed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============ PLAN_PARTICIPANTS TABLE ============
create table public.plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending',  -- pending | approved | declined
  requested_at timestamptz default now(),
  approved_at timestamptz,
  unique (plan_id, user_id)
);

-- ============ MESSAGES TABLE ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============ INDEXES ============
-- Critical index for "find plans near me" queries
create index plans_location_idx on public.plans using gist (location);

-- Additional useful indexes
create index plans_status_idx on public.plans(status);
create index plans_scheduled_at_idx on public.plans(scheduled_at);
create index plan_participants_user_id_idx on public.plan_participants(user_id);
create index messages_plan_id_idx on public.messages(plan_id);
create index messages_sender_id_idx on public.messages(sender_id);

-- ============ ROW LEVEL SECURITY (RLS) ============
-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_participants enable row level security;
alter table public.messages enable row level security;

-- PROFILES: Users can read all profiles, edit only their own
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- PLANS: Anyone can read open plans, users can edit only their own
create policy "Public plans are readable" on public.plans
  for select using (status = 'open' or creator_id = auth.uid());

create policy "Users can create plans" on public.plans
  for insert with check (auth.uid() = creator_id);

create policy "Users can update their own plans" on public.plans
  for update using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- PLAN_PARTICIPANTS: Users can see join requests for their plans or their own
create policy "Participants can view requests for their plan" on public.plan_participants
  for select using (
    user_id = auth.uid() or
    exists (select 1 from public.plans where plans.id = plan_id and plans.creator_id = auth.uid())
  );

create policy "Users can create join requests" on public.plan_participants
  for insert with check (auth.uid() = user_id);

create policy "Plan creators can approve/decline requests" on public.plan_participants
  for update using (
    exists (select 1 from public.plans where plans.id = plan_id and plans.creator_id = auth.uid())
  );

-- MESSAGES: Only approved participants can read/write messages in a plan
create policy "Approved participants can read messages" on public.messages
  for select using (
    exists (
      select 1 from public.plan_participants
      where plan_participants.plan_id = messages.plan_id
      and plan_participants.user_id = auth.uid()
      and plan_participants.status = 'approved'
    ) or
    exists (
      select 1 from public.plans
      where plans.id = messages.plan_id
      and plans.creator_id = auth.uid()
    )
  );

create policy "Approved participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    (
      exists (
        select 1 from public.plan_participants
        where plan_participants.plan_id = messages.plan_id
        and plan_participants.user_id = auth.uid()
        and plan_participants.status = 'approved'
      ) or
      exists (
        select 1 from public.plans
        where plans.id = messages.plan_id
        and plans.creator_id = auth.uid()
      )
    )
  );

-- ============ REALTIME SUBSCRIPTIONS ============
-- Enable realtime for messages (for live chat)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.plan_participants;

-- ============ USEFUL SQL QUERY: Find nearby plans ============
-- This is what you'll call from the frontend
-- replace :user_lat, :user_lng with actual coordinates
-- Example: SELECT * FROM find_nearby_plans(40.7128, -74.0060, 5000)

create or replace function find_nearby_plans(
  user_lat float,
  user_lng float,
  radius_meters int default 5000
)
returns table (
  id uuid,
  creator_id uuid,
  venue_name text,
  location geography,
  activity_type text,
  scheduled_at timestamptz,
  spots_total int,
  spots_filled int,
  description text,
  status text,
  distance_meters float
) as $$
begin
  return query
  select
    plans.id,
    plans.creator_id,
    plans.venue_name,
    plans.location,
    plans.activity_type,
    plans.scheduled_at,
    plans.spots_total,
    plans.spots_filled,
    plans.description,
    plans.status,
    st_distance(plans.location, st_point(user_lng, user_lat)::geography)::float
  from public.plans
  where st_dwithin(plans.location, st_point(user_lng, user_lat)::geography, radius_meters)
    and plans.status = 'open'
    and plans.scheduled_at > now()
  order by distance_meters asc
  limit 50;
end;
$$ language plpgsql;
```

### Enable RLS Policies in Supabase UI
1. Go to **Authentication** → **Policies** (or via SQL Editor)
2. Verify all policies are created (they should be automatically)
3. Go back to **SQL Editor** and run:
```sql
-- Verify RLS is enabled
select tablename, rowsecurity 
from pg_tables 
where schemaname = 'public';
```
All should show `t` (true) for rowsecurity.

---

## Next Steps

1. ✅ Complete this setup guide
2. Check npm installation status:
   ```bash
   cd d:\projects\meetmap
   npm run dev
   ```
   If it complains about missing node_modules, wait for npm to finish (or the terminal will show errors)

3. When npm finishes, you'll have:
   - Local dev server running at `http://localhost:3000`
   - A boilerplate Next.js app ready for code

4. Then we'll:
   - Install Supabase client library
   - Build auth flow (signup/login)
   - Create the map UI
   - And so on...

---

## Common Issues

**"Module not found: can't resolve 'next'"**
→ npm is still installing. Wait 5+ minutes and try again.

**"NEXT_PUBLIC_SUPABASE_URL is missing"**
→ You forgot the `.env.local` file. Create it with the credentials above.

**"Connection refused"**
→ Make sure Supabase project is fully created (wait 2 minutes after creating project).

**"PostGIS not found"**
→ Make sure you ran the `create extension` SQL in Supabase SQL Editor.

---

Questions? We'll tackle each build step together.
