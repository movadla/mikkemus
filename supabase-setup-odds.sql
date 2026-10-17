-- Oddsloggen: én rad per ferdig kamp med oddsen etter hver runde og hvem som vant. Brukes til å måle
-- om oddsene stemmer (kalibrering), se lib/oddsLog.ts. Kjøres én gang i Supabase SQL Editor.
-- Uten tabellen virker alt som før; loggingen feiler stille.
create table if not exists odds_log (
  id uuid primary key default gen_random_uuid(),
  played_at timestamptz not null default now(),
  data jsonb not null
);

alter table odds_log enable row level security;
create policy "public read" on odds_log for select using (true);
create policy "public insert" on odds_log for insert with check (true);
