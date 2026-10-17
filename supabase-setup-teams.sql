-- Lag med statistikk: en rad i players kan være et lag. Kjøres én gang i Supabase SQL Editor
-- før lag tas i bruk (se lib/playerRows.ts). Rader uten verdi i kind er spillere.
alter table players add column if not exists kind text;
alter table players add column if not exists members jsonb;
-- Lagets faste hjemme- og bortedrakt ({ "home": Kit, "away": Kit }, se lib/teamKit.ts).
alter table players add column if not exists kits jsonb;
-- Lengste serie av tellende piler på rad (i piler), for spillere og lag.
alter table players add column if not exists best_run integer;
-- Lagets innmarsj (fanfare, rock, disco eller none), spilles på Full party.
alter table players add column if not exists walk_on text;
-- Hver spillers egne totaler i et lag (treff, bom, piler, avstand), nøklet på navn. Fylles ved hver lagkamp.
alter table players add column if not exists member_stats jsonb;

-- Rating (Elo) for spillere og lag, og hvor mange kamper den er regnet ut fra.
alter table players add column if not exists rating integer;
alter table players add column if not exists rated_matches integer;
