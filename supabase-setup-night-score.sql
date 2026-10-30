-- Kveldsscore: poengene for en kveld, fra kamper i alle spill. Kjøres én gang i Supabase SQL Editor.
-- Uten tabellen virker spillene som før, men kveldene lagres ikke (siden vises tom).
--
-- To slags rader i samme tabell: «evening» (en kveld, som begynner når noen trykker Ny kveld) og
-- «match» (en kamp, med sidene, resultatet, en eventuell overstyring og om den er tatt ut av kvelden).
-- data har radene slik lib/nightScore.ts skriver dem.

create table if not exists night_scores (
  id text primary key,
  kind text not null check (kind in ('evening', 'match')),
  at timestamptz not null default now(),
  data jsonb not null
);

create index if not exists night_scores_at_idx on night_scores (at desc);

alter table night_scores enable row level security;

create policy "public read" on night_scores for select using (true);
create policy "public insert" on night_scores for insert with check (true);
create policy "public update" on night_scores for update using (true);
create policy "public delete" on night_scores for delete using (true);
