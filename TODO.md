# Til senere

Ting som er sagt «til senere». Det som står under «Karrieremodus» er delvis påbegynt (se `CAREER_PLAN.md`).

## SQL som må kjøres i Supabase (SQL Editor)

Kjør hver fil én gang. Uten dem virker appen som før, men det nye lagres bare på enheten, eller ikke i det hele tatt.

- [ ] `supabase-setup-game-results.sql`: statistikk for 301/501, Highstriker og Lava (fanen «Andre spill» under Statistikk). Uten tabellen vises ikke fanen.
- [ ] `supabase-setup-careers.sql`: karrieren (saldo, ranking, turneringen som pågår), slik at den følger deg mellom telefoner.

## Karrieremodus

Er bygget: karrieren bak full kode, pub-bildet (Lü), Lü-cupen som er den vanlige Mikke Mus-turneringen med bots satt ut fra nivået ditt, penger i dollar, rankingpoeng, og utseende (skjorte, darts, startsted) ved oppstart.

- [ ] **Bonusspill mellom turneringene:** 501, Lava og Highstriker mot bots eller alene, der man kan vinne litt penger. Gjenbruker spillene som finnes og bot-kastene.
- [ ] **Hjemmearena og butikk:** seks ting i fire trinn (vegg, gulv, dartbrett, lys, pynt, publikum), animasjon når man kjøper. Utstyr kan gjøre motstanderne litt svakere. Kjøpe nytt sted (fra garasje/kjeller/loft til klubbrom og arena).
- [ ] **Sesong og stige:** kalender, ranking, opprykk til regionale cuper, nasjonal cup, Q-School og tourkort, pro tour, VM. Hvert trinn har egen faktor for hvor sterke motstanderne er. En ny VM-tittel gjør feltet litt sterkere.
- [ ] **Nivået justeres etter faktisk kasting**, ikke bare valget ved start.
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
