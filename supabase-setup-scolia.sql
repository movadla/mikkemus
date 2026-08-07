-- Current board status, kept up to date by the relay script (scripts/scolia-relay.ts).
-- Single row (id = 'current'); the browser reads + subscribes to this instead of
-- connecting to Scolia directly.
create table scolia_status (
  id text primary key,
  board_status text,
  board_phase text,
  error_type text,
  updated_at timestamptz not null default now()
);

alter table scolia_status enable row level security;
create policy "public read" on scolia_status for select using (true);
create policy "public insert" on scolia_status for insert with check (true);
create policy "public update" on scolia_status for update using (true);
alter publication supabase_realtime add table scolia_status;

-- Append-only stream of throw/takeout events forwarded by the relay. The browser
-- subscribes to new inserts here instead of receiving them straight from Scolia.
create table scolia_events (
  id bigint generated always as identity primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table scolia_events enable row level security;
create policy "public read" on scolia_events for select using (true);
create policy "public insert" on scolia_events for insert with check (true);
alter publication supabase_realtime add table scolia_events;
