-- Lag med statistikk: en rad i players kan være et lag. Kjøres én gang i Supabase SQL Editor
-- før lag tas i bruk (se lib/playerRows.ts). Rader uten verdi i kind er spillere.
alter table players add column if not exists kind text;
alter table players add column if not exists members jsonb;
-- Lagets faste hjemme- og bortedrakt ({ "home": Kit, "away": Kit }, se lib/teamKit.ts).
alter table players add column if not exists kits jsonb;
