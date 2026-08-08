-- Kjør denne i Supabase SQL Editor for å legge til kolonnene bak den nye
-- spillerstatistikk-siden (beste runde, favoritt-trippel/dobbel, historikk
-- over tid) — se lib/storage.ts.
alter table players
  add column if not exists best_darts_to_finish integer,
  add column if not exists triple_hits jsonb not null default '{}'::jsonb,
  add column if not exists double_hits jsonb not null default '{}'::jsonb,
  add column if not exists match_history jsonb not null default '[]'::jsonb;
