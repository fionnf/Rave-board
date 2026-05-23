-- Run this once in your Supabase project → SQL Editor

-- Board name
create table if not exists board_settings (
  id text primary key default 'main',
  name text not null default 'CREW BOARD',
  updated_at timestamptz default now()
);
insert into board_settings (id, name) values ('main', 'CREW BOARD') on conflict do nothing;

-- Crew members
create table if not exists members (
  id text primary key,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

-- Per-member vibes
create table if not exists member_vibes (
  member_id text primary key,
  vibe integer not null default 50,
  updated_at timestamptz default now()
);

-- Memories (photos / tracks / notes)
create table if not exists memories (
  id text primary key,
  type text not null,
  caption text,
  title text,
  artist text,
  vibe_note text,
  text_content text,
  tag text,
  member_id text,
  image_url text,
  audio_url text,
  created_at timestamptz default now()
);

-- Row level security — open policies (shared public board)
alter table board_settings enable row level security;
alter table members enable row level security;
alter table member_vibes enable row level security;
alter table memories enable row level security;

create policy "all_access" on board_settings for all using (true) with check (true);
create policy "all_access" on members      for all using (true) with check (true);
create policy "all_access" on member_vibes for all using (true) with check (true);
create policy "all_access" on memories     for all using (true) with check (true);

-- Realtime
alter table board_settings replica identity full;
alter table members        replica identity full;
alter table member_vibes   replica identity full;
alter table memories       replica identity full;

-- Storage bucket for images + audio
insert into storage.buckets (id, name, public) values ('memories', 'memories', true) on conflict do nothing;
create policy "public_access" on storage.objects for all using (bucket_id = 'memories') with check (bucket_id = 'memories');
