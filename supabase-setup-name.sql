-- A name the players give a tournament ("Fredagsdart"). Optional: tournaments without one are saved as before.
alter table tournaments add column if not exists name text;
