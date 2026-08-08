# house.party

Social games for the people you love, the screen in the corner, and one very dramatic narrator.

The first game is Palermo. It supports a shared TV or everyone-plays mode, synchronized phone controllers, private roles and actions, browser narration, 3D game events, reconnect recovery, and reduced motion.

## Run locally

```bash
pnpm install
pnpm dev
```

The multiplayer layer will use Supabase Realtime for room presence and game events. Keep public configuration in `NEXT_PUBLIC_*` environment variables only; never commit a service-role key.

## Verify and record

```bash
pnpm test:e2e
pnpm record:showcase
```

The normal gate runs the six core engine and multiplayer journeys. The showcase command automatically plays its labeled mobile scenario, records the proven full-game finale, and writes `artifacts/palermo-acceptance-reel.mp4`. Video assembly requires `ffmpeg` and `rsvg-convert` (from `librsvg`); generated artifacts stay untracked.
