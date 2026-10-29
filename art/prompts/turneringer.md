# Egne bilder til World Cup of Darts, Sesongfinalen og TV: ledetekster

Disse tre turneringene bruker i dag bildene til trinnet de er bygget på (World Cup foran VM-hallen, finalen foran det siste trinnet du har nådd, TV foran Grand Slam). Med egne bilder blir de steder for seg selv. Hver turnering trenger **to bilder**: stedet utenfra (åpningen) og stedet innenfra (bak trekningen og kampene). Det blir seks bilder.

Bildene du allerede har laget (`public/career/vm-outside.jpg`, `vm-inside.jpg`, `gs-outside.jpg` og så videre) er forbildet: samme sted om kvelden, varmt lys, ingen mennesker i forgrunnen. Last opp ett av dem som referanse i hver ledetekst.

## 1. Mål

| Krav | Utenfra | Innenfra |
|---|---|---|
| Format | Liggende 4:3 (1600 × 1200) | Liggende 5:3 (1800 × 1080) |
| Lagres som | JPEG, under 400 kB | JPEG, under 400 kB |
| Det viktigste | I de midterste 70 % av bredden og i øvre to tredjedeler (nederst ligger knapper) | Scenen eller brettet i midten. Nedre tredjedel kan være mørk (der ligger tallene) |
| Mennesker | Ingen tydelige | Kun silhuetter i publikum, aldri nærbilder |
| Tekst og logoer | **Ingen.** Ingen skilt med bokstaver, ingen merkenavn, ingen tall | **Ingen.** Skjermer viser abstrakte former, ikke tall eller navn |

## 2. Stilbibelen (limes inn i alle ledetekster, uendret)

```
photorealistic, cinematic, warm practical lighting with strong coloured accent light, soft global illumination, clean readable shapes, rich but natural colours, no text, no letters, no numbers, no logos, no brand names, no watermark
```

## 3. Ledetekstene

### World Cup of Darts: utenfra (`wc-outside.jpg`)

```
[STILBIBEL]
A large modern arena entrance seen from the street at dusk, wide shot at eye level. Broad steps up to glass doors, tall banners in abstract colour blocks (no flags, no writing) hanging between pillars, a long red carpet, floodlights fanning into a deep blue sky, a few lit lamps along the road. Festive but dignified. 4:3.
```

### World Cup of Darts: innenfra (`wc-inside.jpg`)

```
[STILBIBEL]
Inside a packed darts arena for a team world championship. Two dartboards side by side on a raised stage at the centre of the frame, a wide LED backdrop with abstract geometric patterns (no text, no numbers), beams of cool white and green light, a crowd in silhouette filling the dark stands, two empty oche positions in front of the boards. Shot from the audience at stage height. 5:3.
```

### Sesongfinalen: utenfra (`finale-outside.jpg`)

```
[STILBIBEL]
An old theatre-like concert hall at dusk, seen from the street. Stone facade with tall arched windows glowing gold, a wide staircase, large empty trophy plinth lit from below in front of the entrance, autumn leaves on the steps, deep indigo sky. Prestigious, calm, a little wintry. 4:3.
```

### Sesongfinalen: innenfra (`finale-inside.jpg`)

```
[STILBIBEL]
Inside a theatre converted for a darts final. A single dartboard on a small round stage in the centre, a gold curtain behind it, spotlights from above forming a cone of light, rows of seats in silhouette, a trophy on a plinth to the left, dark red and gold palette. Intimate and tense. Shot from the stalls. 5:3.
```

### TV: utenfra (`tv-outside.jpg`)

```
[STILBIBEL]
The outside of a television studio building at night. A broadcast truck with a satellite dish parked at the entrance, thick cables on the ground, an abstract glowing red lamp above the door (no words), wet pavement reflecting neon-blue and magenta light, steel and glass facade. Energetic and a little gritty. 4:3.
```

### TV: innenfra (`tv-inside.jpg`)

```
[STILBIBEL]
Inside a television studio set for a darts show. One dartboard in the centre of a glossy black stage floor, huge curved LED screens in magenta and cyan showing abstract waves (no text, no numbers), two large studio cameras on cranes at the edges, a small audience in silhouette behind a low barrier, bright key lights and a haze of smoke. Shot from the front at stage height. 5:3.
```

## 4. Når bildene er laget

1. Legg de seks filene i `public/career/` med navnene over.
2. Åpne `components/eventPictures.ts` og fjern kommentartegnene på linjene i `INVITE_PICTURES`, med nøklene `wc`, `finale` og `tv-kveld` (TV-duellene bruker `tv`): de peker på filene som hører til. Si fra, så gjør jeg det og sjekker i appen.
3. Se over: åpningen, trekningen og en kamp i hver av de tre turneringene. Teksten og knappene skal fortsatt kunne leses oppå bildet.
