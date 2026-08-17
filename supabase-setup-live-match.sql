-- Live snapshot of the in-progress match, kept up to date by MikkeMusApp on every change so a
-- second device (see app/storskjerm/page.tsx) can show a read-only "spectator" view of the same
-- match in real time — same singleton-row pattern as scolia_status.
create table live_match (
  id text primary key,
  state jsonb,
  updated_at timestamptz not null default now()
);

alter table live_match enable row level security;
create policy "public read" on live_match for select using (true);
create policy "public insert" on live_match for insert with check (true);
create policy "public update" on live_match for update using (true);
alter publication supabase_realtime add table live_match;
