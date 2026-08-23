-- Kjør denne i Supabase SQL Editor for å legge til Expected Goals sin
-- pr.-seksjon-nedbrytning på players-tabellen (se lib/storage.ts og
-- lib/dartboard.ts). Erstatter de gamle luck_sum/luck_count-kolonnene
-- (disse er IKKE droppet — bare ikke lenger skrevet til; en trygg,
-- ikke-destruktiv migrasjon er bedre enn å slette gamle kolonner).
alter table players
  add column if not exists luck jsonb not null default '{}'::jsonb;
