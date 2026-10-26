-- Kjør denne i Supabase SQL Editor før den første pokalturneringen mot botter —
-- se lib/botCup.ts (navn, pokal og hvordan botene kaster) og lib/tournamentStorage.ts.
alter table tournaments add column if not exists cup jsonb;
