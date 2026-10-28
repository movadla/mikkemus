# Til senere

Ting som er sagt «til senere». Det som står under «Karrieremodus» er delvis påbegynt (se `CAREER_PLAN.md`).

## SQL som må kjøres i Supabase (SQL Editor)

Kjør hver fil én gang. Uten dem virker appen som før, men det nye lagres bare på enheten, eller ikke i det hele tatt.

- [ ] `supabase-setup-game-results.sql`: statistikk for 301/501, Highstriker og Lava (fanen «Andre spill» under Statistikk). Uten tabellen vises ikke fanen.
- [ ] `supabase-setup-careers.sql`: karrieren (saldo, ranking, turneringen som pågår), slik at den følger deg mellom telefoner.

## Karrieremodus

Er bygget: karrieren bak full kode (se også gjennomgangen med 16 godkjente forslag: enkelt hjem (rommet, én stor SPILL-knapp og fire runde knapper: Rom, Trening, Utfordring og Veien), ett mål, kort før hver kamp med to ansikter og KAST, trekning som kort, pokalhylle, rangeringstitler, profil, lyd og belønninger), hjemmet (garasje, kjeller eller loft) som bakgrunn, hjemmearena med butikk (se rommet bygges om), med trening (nivået følger kastingen), turneringer og utfordringer, stigen Lü-cupen (gratis) → Regionmesterskapet (penger) → Norgesmesterskapet → Grand Slam → VM med kvalifisering, penger i dollar, rankingpoeng, utfordringer i 501, Lava og Highstriker, egen åpningsscene per turnering, scene før finalen og seremoni med pokal når man vinner.

- [ ] **Nye bilder av rommet** (stående 9:16, se `CAREER_ART_PLAN.md`) og **lydfiler** (se `public/career/sounds/README.md`). Bildene som ligger der nå er utkast. Rommet er ti trinn med ett bilde per trinn; bedre dart (vekt og type) i butikken kan komme senere.
- [ ] **Sesong og kalender:** turneringer på bestemte «uker», ranking som teller over tid, flere cuper per trinn.
- [ ] **Balansen må justeres etter at du har spilt:** tallene (faktor, premier, inngang) er satt ut fra simulering med spilleren som en bot.
- [ ] **Flere treningsøvelser** (dobbel, trebling 19, utsjekk) og et bedre mål på nivået enn snittet i én øvelse. I dag flytter «Trebling 20» (15 runder) nivået en fjerdedel av veien, maks 3 mm per økt, siden 45 piler gir et støyende mål.
- [ ] **Sponsorer og utgifter.**
- [ ] **Innlogging per karriere** før modusen åpnes for alle (i dag ligger den bak koden 9696, og alle med koden kan åpne alle karrierer).
- [ ] **Bildene til karrieren** (Midjourney eller lignende): se `CAREER_ART_PLAN.md`. Ikke første prioritet; avgjørelsene nederst i den filen må tas først.
- [ ] Tilpasse spilleren mer: stilisert portrett, flere draktdeler, tatt bilde av seg selv.
- [ ] Rivaler, avisoverskrifter, omdømme (egen verdi, ikke penger), treningsøvelser i arenaen, flere karrierer på en enhet.

## Innlogging og profil
- Innlogging og utlogging.
- Logge inn med e-postadresse og ha en egen profil.

## Tidligere nevnt
- Plan for ekstra enkle 501/301-varianter, og highstriker.
