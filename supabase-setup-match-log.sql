-- Kamparkiv: hele kampen, slik sluttsiden viste den, slik at den kan åpnes igjen fra kamplisten under Statistikk.
-- Kjøres én gang i Supabase SQL Editor. Uten tabellen virker alt som før, men kampene kan ikke åpnes i full visning.
create table if not exists match_log (
  id text primary key,
  created_at timestamptz not null default now(),
  data jsonb not null
);

alter table match_log enable row level security;

create policy "public read" on match_log for select using (true);
create policy "public insert" on match_log for insert with check (true);
create policy "public update" on match_log for update using (true);
