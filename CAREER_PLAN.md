# Karrieremodus

Mål: du spiller alene mot boter gjennom en karriere fra pub-ligaen til VM-finalen. Du tjener penger og rankingpoeng, bygger opp en hjemmearena og kommer høyere opp stigen. Det er et mål, men ingen slutt: man kan vinne VM flere ganger, og for hver tittel blir feltet litt sterkere.

## Prinsipper

- **Spilleren kaster for ekte.** Poengene skrives inn som i 301/501. Penger kan derfor ikke gjøre selve kastet bedre. Utstyret gjør motstanderne litt svakere og arenaen finere; ferdighetene dine er dine egne.
- **Vanskelighetsgraden er relativ.** Motstanderne settes ut fra nivået ditt (målt MED i mm, lavere er bedre), ikke fra faste tall. Da kan alle nå toppen, uansett hvor gode de er. Hvert trinn på stigen legger en fast faktor på toppen, og hver VM-tittel legger på litt til («tittelbelastning»).
- **Kort per turnering.** Karrieren spilles med Mikke Mus-spillet, ikke 501. En kamp tar 7–10 minutter, og Lü-cupen er 8 spillere og tre kamper, ca. en halv time. 501, Lava og Highstriker er bonusspill mellom turneringene (se Faser). Større turneringer er opptil en time. Man kan alltid pause og fortsette senere.
- **Flere kvelder totalt.** En karriere strekker seg over mange turneringer og sesonger.
- **Simulering.** Kampene du ikke spiller selv, simuleres av turneringenes egen simulering (`lib/botSim.ts`). Hver turnering er en vanlig cup (`lib/knockout.ts`), så trekning, bracket, bots og mester-skjermen er de som finnes fra før.

## Vanskelighetsmodellen

`motstanderMED = spillerMED × trinnfaktor × tittelbelastning × formen den dagen`

| Trinn | Faktor (over 1 = svakere enn deg) |
|---|---|
| Lü-cupen (pub) | 1,2 |
| Regionale cuper | 1,12 |
| Nasjonal cup | 1,00 |
| Q-School / tourkort | 0,92 |
| Pro tour | 0,85 |
| Majors og VM | 0,78 |

Tallene er et første forslag og skal justeres med simulering. Utstyret (steg 4) trekker ned bot-MED med noen få prosent, begrenset oppover. Nivået ditt (`skillMED`) velges ved start (Nybegynner 55, Klubbspiller 45, Dyktig 37, Sterk 30) og justeres i steg 3 etter hvordan du faktisk kaster i kampene.

## Stigen

Pub-liga → regionale cuper → nasjonal cup → Q-School / tourkort → pro tour → majors → VM. Hvert trinn har egen inngangsavgift, premiepott, rankingpoeng og bot-felt. Rankingen avgjør hvem som kvalifiserer til neste trinn. Generiske turneringsnavn, ingen PDC-logoer.

## Hjemmearenaen

Man starter i en garasje, en kjeller eller et loft (valgt ved oppstart), og kan kjøpe seg et nytt sted senere. Seks ting kan bygges i fire trinn: vegg, gulv, dartbrett, lys, pynt og publikum. Hvert kjøp bytter ett lag i bildet; stadiet (Kjelleren, Hobbyrommet, Klubbrommet, Arenaen) er bare summen. Forslag til bilder: https://claude.ai/artifact/RAiE9GjToXCyUrqFdJQj6W

## Penger

Inn: premiepenger og sponsorer. Ut: inngangsavgifter, reise (høyere trinn) og utstyr/arena. Pengene er dollar ($), så ingen tar dem for ekte penger. Startsaldo $300. Lü-cupen koster $50, vinneren får $400, finalisten $150. Har du mindre enn inngangen, slipper du inn på kreditt, så en karriere kan aldri stoppe opp.

## Lagring og tilgang

- Karrieren lagres som én post per spiller (`careers` i Supabase, med lokal kopi), og et pågående turneringsløp og pågående kamp lagres underveis, slik at man kan pause.
- Modusen ligger bak full kode (9696) mens vi bygger den. Den begrensede koden ser den ikke. Innlogging per karriere kommer når den åpnes for alle, slik at ingen kan fortsette andres karriere.

## Faser

1. **Spillbar løkke på Lü (bygget)**: karrieremeny, pub-bilde, saldo i dollar, Lü-cupen som en vanlig Mikke Mus-cup med 8 spillere, inngangsavgift og premie, rankingpoeng, lagring og pause, og utseende ved oppstart (skjorte, darts, startsted).
1b. **Bonusspill mellom turneringene**: 501, Lava og Highstriker mot bots eller alene, med litt penger å vinne.
2. **Hjemmearena og butikk**: seks ting × fire trinn, animasjon når penger kommer inn og brukes.
3. **Sesong og stige**: kalender, pub-sesong, ranking, opprykk, nivåjustering etter faktisk kasting, flere trinn av felt.
4. **Sponsorer og utgifter.**
5. **Høyere nivåer**: Q-School, tourkort, pro tour, majors og VM-kvalifisering, med kortere formater og simulering av kampene du ikke spiller.
6. **Tillegg**: rivaler, avisoverskrifter, omdømme (egen verdi, ikke penger), treningsøvelser i arenaen, sesongkort å dele, flere karrierer på en enhet, automatisk poengføring via Scolia.

## Risikoer

- **Spilletid** på de høyeste nivåene (sett og legs): kortere formater, pause/fortsett og simulering.
- **Balanse** (for mye penger, for harde motstandere): hele sesonger simuleres i tester før tallene låses.
- **Navn og varemerker**: generiske navn.
