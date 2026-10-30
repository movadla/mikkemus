-- Halv It og Killer i statistikken (fanen «Andre spill»). Kjøres én gang i Supabase SQL Editor, etter
-- supabase-setup-game-results.sql. Uten den kan resultatene til de to spillene ikke lagres: tabellen godtar
-- bare de fire første spillene.

alter table game_results drop constraint if exists game_results_game_check;
alter table game_results add constraint game_results_game_check check (game in ('301', '501', 'highstriker', 'lava', 'halvit', 'killer'));
