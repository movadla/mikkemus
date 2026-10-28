# Rommet i ti trinn: ledetekster og arbeidsgang (stående 9:16)

Dette er alt du trenger for å lage de ti bildene på nytt, i riktig format for telefonskjermen. Bildene du allerede har laget er forbilde: samme rom, samme historie fra rot til drømmerom. Det som endres er formatet (stående), kameraet (identisk på alle) og at bildet skal ha luft til knappene.

Når bildene er laget: legg dem i `public/career/` som `room-01.jpg` til `room-10.jpg` (overskriv de gamle), kjør `npm run check:room`, og åpne karrieren i appen.

## 1. Mål for hvert bilde

| Krav | Verdi |
|---|---|
| Format | Stående 9:16 (Midjourney `--ar 9:16`, GPT-image 1024 × 1792 eller 1080 × 1920) |
| Størrelse | 1080 × 1920 er best. Minst 1080 × 1920 om du kan. Lagres som JPEG (`.jpg`), under 700 kB |
| Kamera | Rett forfra, i brysthøyde, vidvinkel (24 mm), uten tilt. **Nøyaktig samme på alle ti** |
| Dartbrettet | Midt i bildet vannrett (50 %), 36 % ned fra toppen, ca. 34 % av bildebredden. **Samme sted på alle ti** |
| Gulvet | Nederste fjerdedel er gulv og oche, uten viktige detaljer (der ligger knappene) |
| Taket | Øverste 12 % er tak eller vegg uten viktige detaljer (der ligger saldo og nivå) |
| Sidene | Det viktigste står i de midterste 70 % av bredden. Telefoner med smal skjerm kutter sidene |
| Tekst og logoer | Ingen. Ikke «501», ikke merkenavn. Skiltet i trinn 10 skal være et symbol (krone) uten bokstaver, eller utelates |
| Mennesker | Ingen |

## 2. Slik får du samme rom på alle ti (viktigst)

Tre verktøy som kan redigere et bilde uten å lage et nytt fra bunnen: **ChatGPT-bilder** (last opp forrige bilde og beskriv endringen), **Midjourney** (Editor eller «Vary Region») og **Flux Kontext**. Bruk ett av dem gjennom hele serien.

1. Lag trinn 1 først, og få det riktig: kameraet, brettets plass og luften øverst og nederst. Bruk så lang tid du trenger. Alt annet bygger på dette bildet.
2. Lag trinn 2 ved å **redigere trinn 1**. Last opp trinn 1 og skriv: *«Keep everything exactly the same (camera angle, framing, dartboard position and size, room shape, lighting direction). Only change: …»* og så endringen fra tabellen under.
3. Lag trinn 3 ved å redigere trinn 2, og så videre. Aldri lag et trinn på nytt fra tekst: da flytter alt seg.
4. Sjekk hvert nytt trinn mot det forrige: ligger brettet nøyaktig der det lå? Hvis ikke, prøv samme redigering igjen eller bruk en maske rundt området som skal endres.

## 3. Stilbibelen (limes inn i alle ledetekster, uendret)

```
photorealistic interior, cinematic, warm practical lighting, soft global illumination, shallow depth of field, clean readable shapes, rich but natural colours, shot on a 24mm lens at chest height, straight-on, symmetrical composition, vertical 9:16 portrait, no text, no logos, no brand names, no people
```

## 4. Trinn 1: den første ledeteksten

```
[STILBIBEL]
A cluttered home garage used as a darts room. A dartboard hangs at the exact centre of the frame, 36% down from the top, about one third of the image width, mounted on a tall rough cork panel leaning on cardboard. Left: a wire rack stuffed with junk (boxes, bags, tools). Right: a white cabinet and a black rolling toolbox, cardboard boxes on the floor. Dirty concrete floor with stains, a worn small rug and flattened boxes in the lower quarter. Dim, one bare overhead bulb, damp and messy. The top 12% is plain ceiling and the bottom quarter is only floor. --ar 9:16
```

## 5. Trinn 2 til 10: hva som endres (limes inn etter «Only change:»)

Hvert trinn bygger på det forrige, så alt som er lagt til blir stående.

| Trinn | Navn | Pris | Endring |
|---|---|---|---|
| 2 | Ryddet | $500 | the junk is cleared: the wire rack becomes a tidy bare metal shelving unit with a few neat boxes, the floor is swept, the cardboard and rug are gone, only the white cabinet and toolbox remain |
| 3 | Nye vegger | $1 000 | the walls are painted a deep dark green and covered in clean wall panels, the cork panel stays behind the board, a plain small rug on the floor, brighter even light |
| 4 | Kastelinje | $2 000 | a black dart mat with a warm wooden edge and a white throwing line is laid on the floor in front of the board, running toward the camera |
| 5 | Lys | $3 500 | a glowing warm LED ring light around the dartboard and small ceiling spotlights, warm golden mood, one or two small framed pictures on the walls |
| 6 | Skjerm | $5 000 | a wall-mounted TV on the left showing a generic scoreboard with only numbers and a dartboard graphic, and a small scoreboard sign on the right, wooden shelves and a desk below |
| 7 | Utstyr | $7 500 | a wall shelf with dart gear (rows of darts and flights), a plant, the toolbox becomes a neat dark workbench |
| 8 | Dekor | $10 000 | framed posters and a signed shirt in a frame on the walls, small trophies on a shelf, a warm lamp and more plants |
| 9 | Proffoppsett | $15 000 | a wall of vertical wooden acoustic slats with warm light behind them around the board, premium details: brass, glass, a lit display shelf |
| 10 | Drømmerommet | $25 000 | a small bar with two stools and a glass-door fridge on the right, a warm glowing crown-shaped neon sign above the board (symbol only, no letters), a black mat with a gold crown pattern |

Eksempel på full ledetekst for trinn 3 (limes inn sammen med bildet fra trinn 2):

```
Keep everything exactly the same (camera angle, framing, dartboard position and size, room shape, lighting direction, all objects not mentioned). Only change: the walls are painted a deep dark green and covered in clean wall panels, the cork panel stays behind the board, a plain small rug on the floor, brighter even light. Photorealistic, vertical 9:16, no text, no logos.
```

## 6. Sjekkliste før du legger bildene i appen

- [ ] Alle ti er 9:16 og like store.
- [ ] Brettet står på samme sted i alle ti (legg dem etter hverandre og bla: brettet skal ikke hoppe).
- [ ] Ingen tekst, logo, merkenavn eller mennesker.
- [ ] Øverste 12 % og nederste fjerdedel er rolige.
- [ ] Filene heter `room-01.jpg` til `room-10.jpg`, er JPEG og under 700 kB.
- [ ] `npm run check:room` viser «Alle ti er stående 9:16».

## 7. Rettigheter

Sjekk vilkårene til verktøyet du bruker (betalt plan, kommersiell bruk) før appen blir offentlig. Lagre ledeteksten, verktøyet og versjonen sammen med bildene (for eksempel i en notatfil ved siden av), slik at et trinn kan lages likt på nytt.
