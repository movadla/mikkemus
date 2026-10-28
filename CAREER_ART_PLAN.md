# Bildeplan for karrieren

Mål: bilder som ser ut som et ekte spill (hjemmearenaen, Ly, spilleren), med samme utseende i alle, der en oppgradering bare endrer det som er kjøpt. Dette er ikke første prioritet: karrieren bygges først med enkle tegninger (se `CAREER_PLAN.md`), og bildene byttes inn etterpå uten å endre koden rundt. Beslutninger som må tas før noe lages, står nederst.

## Hvordan alle bildene får samme utseende

1. **Én stilbibel.** En fast tekstblokk (stil, lys, farger) som limes inn i hver ledetekst, og som aldri endres underveis. Forslag: «stylized 3D game environment, semi-realistic, soft global illumination, warm cinematic lighting, shallow depth of field, clean readable shapes, no text, no logos, no people».
2. **Ett kamera.** Samme vinkel, samme avstand og samme høyde i alle bildene i et rom, med dartbrettet på samme sted. Det er det som gjør at bildene kan bytte om på hverandre.
3. **Lag først, rom etterpå.** Lag først rommet slik det er i trinn 1, og få det riktig. Lag deretter de neste trinnene ved å **redigere samme bilde** (Midjourneys «Editor/Vary Region», GPT-image-redigering med maske, eller Flux Kontext), ikke ved å lage et nytt bilde fra tekst. Da forblir resten av rommet uendret, og bare det du ber om endres.
4. **Lagdeling til slutt.** Når trinnene er laget slik, kan et skript regne ut hva som er endret mellom to trinn og klippe det ut som et eget lag med gjennomsiktig bakgrunn. Da kan appen legge lysene, brettet og publikummet oppå hverandre og animere dem hver for seg (flimring, støv, sveipende stråler). Dette kan jeg lage når bildene finnes.

## Hvor mange bilder

Minimum for å se om løkken fungerer: **8 hele rom**.

| Bilde | Antall |
|---|---|
| Starten, trinn 1 og 2 for hver av de tre stedene (garasjen, kjelleren, loftet) | 6 |
| Felles trinn 3 og 4 (Klubbrommet og Arenaen), som alle kommer til | 2 |
| Pub-fasaden (Ly, kvelds-gate) og Ly innvendig | 2 |

Utvidelse (lagdelt): for hvert rom seks ting (vegg, gulv, dartbrett, lys, pynt, publikum) i tre oppgraderingstrinn, som egne lag: 18 lag per rom. Det er mer, men gir et kjøp som synes i bildet med en gang. Start med det minste og utvid dit det føles best.

## Tekniske krav

- **Format:** stående, 3:4 (telefonen), generert i minst 1536 × 2048 og lagret som WebP. Hold viktige ting innenfor en sikker sone i midten, siden toppen og bunnen dekkes av menyen.
- **Lys til animasjon:** be om at lyskildene er tydelige (pære, spotter, neon, skjerm), siden de er det som animeres.
- **Ingen tekst, logoer eller kjente personer** i bildene. Tekst legges på i appen.
- **Lagre ledetekstene** i repoet (`art/prompts/`) sammen med verktøy, versjon og seed, slik at et bilde kan lages på nytt og et nytt rom ser likt ut.

## Ledetekstmal

```
[STILBIBEL]
Interior of a [garage / basement / loft], front view, camera at chest height, centred on a dartboard hung on the back wall,
throw line on the floor in the foreground, [STAGE DETAILS], [LIGHTING BY STAGE], empty room, 3:4 portrait --ar 3:4
```

Trinn og lys per stadium:

1. **Starten:** dårlig lys, naken pære, brettet på en planke, kald betong, pappeske. «dim, one bare bulb, damp, cluttered».
2. **Hobbyrommet:** malt vegg, parkett, brettet i et skap, en spotlight over. «warm single spotlight, tidy».
3. **Klubbrommet:** trepanel, pokalhylle, neonskilt, lysring rundt brettet. «warm wall lamps, neon accent».
4. **Arenaen:** storskjerm bak brettet, lysrigg, scene med teppe. «dramatic stage lighting, haze, light beams».

Ved redigering: «Keep everything exactly the same, only change: [the dartboard to a tournament board with a black surround]».

## Spilleren og draktene

Draktene er tegnet i koden i dag og kan velges fritt. Bildet av spilleren er rosterbildet. Senere kan begge få et mer spillaktig utseende, enten ved at et stilisert portrett lages av et bilde (bildet sendes da til et eksternt verktøy: avklar det med spillerne først), eller ved et lite utvalg ferdige figurer å velge mellom. Det er lav prioritet.

## Det som må avgjøres før vi starter

1. Stilen: stilisert 3D (som en mobilspill-kjeller) eller mer realistisk?
2. Verktøy: Midjourney, GPT-image eller Flux. Sjekk vilkårene for kommersiell bruk (betalt plan) før appen blir offentlig.
3. Er garasje, kjeller og loft alle med i første versjon, eller bare garasjen?
4. Skal pub-fasaden og Ly innvendig være bilder, eller beholdes tegningen i koden?

## Rekkefølge

1. Velg stil og verktøy, lag stilbibelen og to prøvebilder av garasjen (trinn 1 og 2) for å se om redigeringen holder rommet likt.
2. Lag resten av de 8 rommene, og la meg legge dem inn med myke overganger og enkle animasjoner.
3. Hvis det fungerer, lag lag for hver ting og la meg klippe dem ut automatisk.

## Slik brukes bildene nå (2026-10-28)

Rommet er ti trinn, ett bilde per trinn, og bildet er bakgrunn for hjem, Rom, Veien, Trening og Utfordring. Bildene ligger i `public/career/room-01.jpg` til `room-10.jpg` (trinn 1 til 10: Start, Ryddet, Nye vegger, Kastelinje, Lys, Skjerm, Utstyr, Dekor, Proffoppsett, Drømmerommet). Trinnene, navnene og prisene står i `lib/career.ts` (`STAGES`).

De ti bildene som ligger der nå er klippet ut av et rutenett og er bare 300 × 360 px, så de er grumsete på en stor skjerm. De er et utkast. For å bytte dem ut: lag nye filer med **samme navn** og legg dem i `public/career/`. Ingenting annet må endres.

Slik bør de nye bildene være:
- **Stående 9:16, 1080 × 1920**, JPEG eller WebP. Bildet dekker hele telefonskjermen, så 5:6 blir beskåret i sidene.
- **Samme kamera på alle ti**, med dartbrettet nøyaktig midt i bildet på alle trinn (i dag flytter det seg litt mellom trinn 2 og 3).
- **Luft øverst og nederst.** Saldo og nivå ligger øverst, og navn, SPILL-knappen og de runde knappene nederst. Det viktigste i rommet bør ligge i midten, mellom 20 og 70 prosent av høyden.
- **Ingen tekst eller logoer** i bildene.
- Hvert trinn laget ved å **redigere forrige bilde**, så det som ikke endres ser likt ut.

Ferdige ledetekster, arbeidsgang og sjekkliste for de nye bildene: `art/prompts/room-9x16.md`. Kjør `npm run check:room` for å sjekke at filene er riktige.

Lydfiler: se `public/career/sounds/README.md`. Mangler en fil, lager appen lyden selv.
