create table players (
  id text primary key,
  name text not null,
  photo text,
  sound text,
  matches_played integer not null default 0,
  matches_won integer not null default 0,
  darts_in_wins integer not null default 0,
  overall_hits integer not null default 0,
  overall_misses integer not null default 0,
  steps jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table players enable row level security;

create policy "public read" on players for select using (true);
create policy "public insert" on players for insert with check (true);
create policy "public update" on players for update using (true);
create policy "public delete" on players for delete using (true);

alter publication supabase_realtime add table players;
