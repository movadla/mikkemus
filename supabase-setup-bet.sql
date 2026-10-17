-- /bet: spill på morro med virtuelle mynter. Ingen ekte penger, og ingen bank:
-- et spill er mellom to deltakere. Kjøres én gang i Supabase SQL Editor.
-- Uten tabellene viser /bet en veiledning i stedet; resten av appen virker som før.
--
-- Regnskapet er en rad-for-rad-logg (bet_ledger): saldoen er summen av endringene, så to telefoner kan
-- legge inn spill samtidig uten å overskrive hverandre.

create table if not exists bet_users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Én kamp, slik /bet så den: hvem som spilte og hvem som vant. Brukes til å avgjøre spillene.
create table if not exists bet_matches (
  match_id text primary key,
  sides jsonb not null,
  winner text,
  status text not null default 'open' check (status in ('open', 'done', 'void')),
  created_at timestamptz not null default now()
);

-- Et spill: backer satser stake på at pick vinner, til oddsen. Layer tar motsatt side og risikerer
-- liability (= stake × (odds − 1)). Vinneren får hele potten (stake + liability). Så lenge ingen har
-- tatt imot, er spillet «open» og kan trekkes tilbake.
create table if not exists bet_bets (
  id uuid primary key default gen_random_uuid(),
  backer_id uuid not null references bet_users (id) on delete cascade,
  layer_id uuid references bet_users (id) on delete cascade,
  match_id text not null,
  pick text not null,
  stake integer not null check (stake > 0),
  odds numeric(7, 2) not null check (odds >= 1),
  liability integer not null check (liability >= 0),
  turn integer not null,
  phase text not null check (phase in ('pre', 'live')),
  status text not null default 'open' check (status in ('open', 'matched', 'won', 'lost', 'void', 'cancelled')),
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists bet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references bet_users (id) on delete cascade,
  night integer not null default 1,
  delta integer not null,
  reason text not null check (reason in ('start', 'stake', 'lay', 'payout', 'refund', 'adjust')),
  bet_id uuid references bet_bets (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Én rad av hver slags per spill og person, aldri to: gjør avgjøringen trygg å kjøre fra flere telefoner.
  unique (bet_id, reason, user_id)
);

alter table bet_users enable row level security;
alter table bet_matches enable row level security;
alter table bet_bets enable row level security;
alter table bet_ledger enable row level security;

create policy "public read" on bet_users for select using (true);
create policy "public insert" on bet_users for insert with check (true);
create policy "public delete" on bet_users for delete using (true);

create policy "public read" on bet_matches for select using (true);
create policy "public insert" on bet_matches for insert with check (true);
create policy "public update" on bet_matches for update using (true);

create policy "public read" on bet_bets for select using (true);
create policy "public insert" on bet_bets for insert with check (true);
create policy "public update" on bet_bets for update using (true);
create policy "public delete" on bet_bets for delete using (true);

create policy "public read" on bet_ledger for select using (true);
create policy "public insert" on bet_ledger for insert with check (true);

-- Spill på antall streker (seiersmargin): hvor mange kryss taperen mangler når vinneren er ferdig.
-- Kjøres også om du allerede har laget tabellene over. Trygt å kjøre flere ganger.
alter table bet_bets add column if not exists market text not null default 'winner';
alter table bet_bets add column if not exists detail text;
alter table bet_matches add column if not exists margin integer;
