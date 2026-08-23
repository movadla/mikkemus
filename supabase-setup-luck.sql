-- Kjør denne i Supabase SQL Editor for å legge til Expected Goals
-- (flaks/uflaks) karriere-kolonnene på players-tabellen (se lib/storage.ts
-- og lib/dartboard.ts).
alter table players
  add column if not exists luck_sum double precision not null default 0,
  add column if not exists luck_count integer not null default 0;
