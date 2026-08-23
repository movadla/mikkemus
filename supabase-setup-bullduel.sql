-- Kjør denne i Supabase SQL Editor for å legge til Bull-duell
-- karriere-kolonnen på players-tabellen (se lib/storage.ts og lib/bullDuel.ts).
alter table players
  add column if not exists bull_duel jsonb not null default '{}'::jsonb;
