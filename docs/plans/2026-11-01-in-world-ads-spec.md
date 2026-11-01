# In-World Ads (TrafficStars) — Spec

Status: steps 1–3 implemented (station art + places, banner overlay, admin page) · step 4 pending · 2026-11-01

## Goal

Ad places that look like part of the station: a backlit poster on a wall, a sticker
on a cargo container, a small screen on a girder (see the station mockup). Each place
is a TrafficStars spot. Spot codes are added in a settings file through an admin page,
without touching the game code.

Not annoying: places sit on far layers, never at platform edges where fights happen,
nothing flashes, and ads never react to clicks during a match.

## Constraint

A TrafficStars spot gives a JS/iframe banner code, not a picture. The game cannot
read pixels from a third-party iframe, so it cannot paint the banner onto its own
canvas. The banner is therefore shown **over** the game, exactly inside the in-world
frame, and moves with the camera.

## How a place works

1. **In the map.** Each map lists its ad places: id, which layer (wall / containers /
   girders), the rectangle in world coordinates, the frame kind (lightbox / sticker /
   screen) and the banner size of its spot.
2. **In-world frame.** The game draws the frame, mounting and shadow as part of the
   map art (lightbox metal frame and spill light, sticker edges, screen bezel).
3. **The banner.** A `<div>` above the game canvas holds a sandboxed `<iframe>` with
   the spot code. Every frame it is moved and scaled to the place's on-screen
   rectangle (the iframe keeps its native size, e.g. 300×250, and is scaled with CSS
   transform, so it stays sharp).
4. **Blending.** A CSS filter per map (brightness, contrast, saturation) gives the
   banner the scene's light. A thin overlay above it adds the glass sheen (lightbox,
   screen) or wear (sticker).
5. **Fighters in front.** When a fighter or a shot overlaps the place, the banner
   fades to 25% so the fight stays readable, and comes back after.
6. **No clicks in a match.** `pointer-events: none` while playing: a click is a shot.
   Clickable banners live in the menu and on the results screen (same settings).

## When an ad loads and counts

TrafficStars counts the impression itself when its code runs, so we must not load
banners nobody sees:
- A place loads its spot only after it has been at least 50% on screen for 1 second.
- Refresh: at most once per `refreshSec` (default 60) and only while visible.
- Off-screen places keep their banner but stay hidden.
- At most 3 banners loaded at once (phones).

## When there is no ad

No code configured, the spot returned nothing, or it failed to load within 5 s: the
place shows a **house poster** — our own in-world art (fictional brands, game tips),
drawn by the game. The station never has empty frames.

## Settings file: `public/ads.json`

```json
{
  "version": 1,
  "refreshSec": 60,
  "places": {
    "station.wall-poster-a":   { "enabled": true,  "size": "300x250", "code": "<script …></script>" },
    "station.wall-poster-b":   { "enabled": true,  "size": "300x250", "code": "…" },
    "station.container-decal": { "enabled": true,  "size": "300x100", "code": "…" },
    "station.led-panel":       { "enabled": false, "size": "728x90",  "code": "" },
    "menu.side":               { "enabled": true,  "size": "300x250", "code": "…" },
    "results.bottom":          { "enabled": true,  "size": "728x90",  "code": "…" }
  }
}
```

Loaded at game start; a missing or broken file means house posters everywhere.
Works on any hosting (GitHub Pages included): change the file, redeploy.

## Admin page `/#ads-admin`

- List of all ad places grouped by map, each with a preview of where it is.
- For each place: on/off, size, a field to paste the TrafficStars spot code.
- **Test** button: renders the real banner inside the in-world frame preview.
- Checks: the code looks like a TrafficStars code, the size matches the place.
- **Download ads.json** (to put into `public/` and deploy) and **Load ads.json**
  (to edit the current one).
- The page edits a draft in the browser only; nothing is saved on the server, so
  there is no password to leak.

## Security

The spot code runs only inside a sandboxed iframe (`allow-scripts allow-popups
allow-popups-to-escape-sandbox`), never in the game page: a third-party script cannot
read the game state or the player's data.

## Files (planned)

| File | Responsibility |
|---|---|
| `src/game/render/scene/adPlaces.ts` | ad places of the station (data, layer → screen) |
| `src/game/render/scene/adFrames.ts`, `houseAds.ts` | in-world frames and house posters |
| `src/game/ads/adConfig.ts` | load and validate `ads.json` |
| `src/game/ads/adVisibility.ts` | on-screen share, 1 s rule, refresh, fight overlap |
| `src/game/ads/adOverlay.ts` | sandboxed iframes over the canvas, platform clip-path, fill check |
| `src/game/ads/adsController.ts` | wires config, scene and overlay into the game loop |
| `src/components/ads/AdsAdmin.tsx`, `AdPlaceCard.tsx`, `BannerTest.tsx`, `adsDraft.ts` | the admin page |

Implementation notes: platforms standing in front of a place are cut out of the banner
with `clip-path: path(evenodd, …)`; a small script next to the spot code reports after
5 s whether anything rendered (if not, the banner hides and the house poster shows).

## Order of work

1. Map art pipeline and the station theme from the mockup, with the three frames and
   house posters (no network ads yet).
2. Ad overlay, settings file, visibility rules.
3. Admin page.
4. Mine (Tunnels) and arena (Hunger Games) themes with their own places — the arena
   gets big screens above the arena, natural for a survival show.

## Testing

- Unit tests: world → screen rectangle, on-screen share and the 1-second rule,
  fighter overlap fade, `ads.json` validation, fallback to house posters.
- Manual: one real spot per size on a test page, on desktop and phone.

## Open questions

1. Which banner sizes do our spots support? Places use 300×250 (wall lightboxes), 300×100 (container sticker) and 728×90 (LED panel).
2. Is a non-clickable in-game placement fine under TrafficStars rules, and what
   refresh interval is allowed?
3. Consent: TrafficStars scripts may set cookies; do we need a consent banner for EU
   players before loading ads?
