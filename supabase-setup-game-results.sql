-- Statistikk for 301/501, Highstriker og Lava (fanen «Andre spill» under Statistikk). Kjøres én gang i
-- Supabase SQL Editor. Uten tabellen virker spillene som før, men ingenting lagres og fanen vises ikke.
--
-- Én rad per ferdig spill. data har resultatet slik lib/gameResults.ts skriver det: vinner, spillere,
-- hvem som var bot og tallene til hver spiller. Angrer man seieren på vinnerskjermen, slettes raden igjen.

create table if not exists game_results (
  id text primary key,
  game text not null check (game in ('301', '501', 'highstriker', 'lava')),
  played_at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists game_results_played_at_idx on game_results (played_at desc);

alter table game_results enable row level security;

create policy "public read" on game_results for select using (true);
create policy "public insert" on game_results for insert with check (true);
create policy "public update" on game_results for update using (true);
create policy "public delete" on game_results for delete using (true);
