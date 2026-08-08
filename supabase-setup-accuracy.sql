-- Kjør denne i Supabase SQL Editor for å legge til MED/MHD/MVD-kolonnene
-- på players-tabellen (se lib/storage.ts og lib/dartboard.ts).
alter table players
  add column if not exists accuracy_sum_distance double precision not null default 0,
  add column if not exists accuracy_sum_horizontal double precision not null default 0,
  add column if not exists accuracy_sum_vertical double precision not null default 0,
  add column if not exists accuracy_throws integer not null default 0;
