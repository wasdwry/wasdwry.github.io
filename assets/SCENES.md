# Animated pixel scenes

The live site has three scenes: `outside`, `hall`, and `study`. Desk panels are reading and writing surfaces inside the study. Older beach, town, and mine artwork is not used as a live scene.

- `scene-clock.mjs` owns the visitor's local day/night lighting and the crop shared by the outdoor canvas and cabin hotspot.
- `pixel-landscape.mjs` implements the approved landscape sample using the existing WebP artwork. Clouds, water, chimney smoke, stars, and fireflies animate separately from buildings and mountains.
- `pixel-rooms.mjs` uses each room's own day/night paintings. Window frames and furniture remain stationary. Sky/water masks, fireplace motion, steam, dust, and lamp glow are expressed in the original 1660 × 948 coordinates.
- `dynamic-background.js` loads scenes on demand and runs only the visible scene, capped at 30 frames per second. It stops motion in hidden tabs and while the diary dialog is open. The small pause control persists a visitor's preference; the operating system's reduced-motion preference is respected.

CSS keeps the original paintings visible if animation assets fail to load. No video, GIF, third-party renderer, or new external asset host is required.

When replacing an illustration, update its masks and inspect both day and night. The outdoor canvas uses 1716 × 916 coordinates. Do not apply a whole-scene distortion or move window frames to simulate animation.

Validation: run `node --test tests/*.test.mjs`; inspect all three scenes in day, dusk, and night; check narrow screens, cabin/desk/bookshelf interactions, pause/resume, and background suspension while the desk is open.
