# jeugdalpha-papendrecht.nl

Statische site, gehost op GitHub Pages (`CNAME` → jeugdalpha-papendrecht.nl).
Geen framework, geen dependencies, geen build in de deploy: GitHub Pages serveert
de HTML-bestanden die in deze repo staan.

## Iets aanpassen

### Nieuw seizoen / datum gewijzigd → `data/events.json`

Dit is de enige plek waar de agenda staat. De homepage (eerstvolgende avonden),
de seizoenskalender en de "dit seizoen loopt van … tot …"-teksten op contact en
kalender lezen dit bestand in de browser in.

```jsonc
{
  "season":  { "label": "Najaar 2026", "startDate": "2026-09-19", "endDate": "2026-12-12", ... },
  "defaults": { "start": "19:00", "end": "21:30", "location": { ... } },
  "events":  [ { "date": "2026-09-19", "title": "Startavond", "description": "…" }, ... ]
}
```

Een avond erft tijd en locatie uit `defaults`. Zet een veld expliciet op `null`
om het weg te laten — zo heeft het Alphaweekend geen tijd en geen locatie.
Committen is genoeg; er hoeft niets gebouwd te worden.

### Social media-links → `data/site.json`

De Instagram-, Facebook- en WhatsApp-velden staan op `null`. Zolang dat zo is,
worden de knoppen niet weergegeven — er komt dus nooit een kapotte link op de
site. Vul het in en ze verschijnen in de footer en op de contactpagina.
WhatsApp: internationaal nummer zonder `+` of `0`, bijv. `31612345678`.

### Nieuw fotoalbum

1. Zet de foto's in een map onder `wp-content/uploads/Fotos/<Albumnaam>/`.
2. `python3 tools/scan-photos.py` — dit werkt `data/albums.json` bij.
3. Titel en beschrijving van het album staan in dat bestand; pas ze aan.

### Tekst, menu, footer of een nieuwe pagina

De pagina's worden gegenereerd uit `src/`:

```
src/layout.html          het HTML-omhulsel (meta, og-tags, css, js)
src/partials/header.html menu
src/partials/footer.html footer
src/pages/*.html         de inhoud per pagina, met front matter bovenaan
src/series.html          template voor één animatieteam-serie
```

Na een wijziging:

```
python3 tools/build.py
```

Dat schrijft de HTML weg (`index.html`, `contact/index.html`, …) plus
`sitemap.xml`. Commit de gegenereerde bestanden mee.

### Animatieteam: serie of aflevering erbij → `data/animatieteam.json`

Daarna `python3 tools/build.py`. Video's kunnen `yt` (YouTube), `vimeo` of
`drive` (Google Drive) zijn. Er wordt niets ingeladen tot iemand op play klikt.

## Lokaal bekijken

```
python3 -m http.server 8000
```

Daarna http://localhost:8000. Een gewone `file://` opent werkt niet, omdat de
JSON-bestanden via `fetch` geladen worden.

## Fonts

Anton en Inter staan in `assets/fonts/` en worden vanaf ons eigen domein
geserveerd. Bewust niet via `fonts.googleapis.com`: dat stuurt het IP-adres van
elke bezoeker naar Google en dat is voor een Nederlandse site een AVG-probleem.
Regenereren kan met de CSS van Google Fonts; `assets/css/fonts.css` bevat verder
niets bijzonders.

## De kaart in de footer

Google laat zich niet meer zonder API-key in een iframe zetten — je krijgt dan
alleen een klein "Maps"-knopje te zien in plaats van een kaart. Daarom staat er
nu een stilstaand plaatje in de footer dat doorlinkt naar Google Maps voor een
routebeschrijving. Dat plaatje werkt altijd, kost geen verzoek aan een derde
partij en heeft geen WebGL nodig.

Wil je wel een echte Google-kaart? Vraag een
[Maps Embed API](https://developers.google.com/maps/documentation/embed/get-api-key)-key
aan en zet die in `data/site.json`:

```json
"maps": { "query": "Elimkerk P.C. Hooftlaan 178 Papendrecht", "embedKey": "AIza…", "zoom": 16 }
```

Zodra `embedKey` gevuld is, vervangt de footer het plaatje automatisch door de
Google-kaart. Er hoeft niets gebouwd te worden.

Het huidige plaatje (`assets/img/map-elimkerk.jpg`) is gemaakt uit
OpenStreetMap-tiles, gecentreerd op 51.8278124, 4.6818032. Vervang je het niet
door een Google-kaart, laat dan de bronvermelding "Kaart © OpenStreetMap"
staan — dat is een licentievoorwaarde.
