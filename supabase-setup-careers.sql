-- Karrieremodus (se CAREER_PLAN.md og lib/career.ts). Kjøres én gang i Supabase SQL Editor.
-- Uten tabellen virker karrieren fortsatt, men bare på enheten den ble startet på.
--
-- Én rad per karriere. data er hele karrieren slik lib/career.ts skriver den: saldo, rankingpoeng, historikk
-- og turneringen som pågår (også kampen midt i spill), slik at man kan pause og fortsette på en annen telefon.
-- Tilgangen styres foreløpig av koden til appen; innlogging per karriere kommer før modusen åpnes for alle.

create table if not exists careers (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table careers enable row level security;

create policy "public read" on careers for select using (true);
create policy "public insert" on careers for insert with check (true);
create policy "public update" on careers for update using (true);
create policy "public delete" on careers for delete using (true);
