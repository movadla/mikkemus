-- Kjør denne i Supabase SQL Editor for å legge til turneringsmodus — se
-- lib/tournament.ts (datamodell) og lib/tournamentStorage.ts (lagring).
create table if not exists tournaments (
  id text primary key,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  mode text not null,
  participants jsonb not null,
  groups jsonb not null,
  matches jsonb not null,
  status text not null,
  winner text
);
