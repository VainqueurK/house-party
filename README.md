# house.party

Social games for the people you love, the screen in the corner, and one very dramatic narrator.

The first game is Palermo. The current build includes the animated landing experience, room join flow, host lobby, TV-first game screen, browser narration, and a reduced-motion accessibility mode.

## Run locally

```bash
pnpm install
pnpm dev
```

The multiplayer layer will use Supabase Realtime for room presence and game events. Keep public configuration in `NEXT_PUBLIC_*` environment variables only; never commit a service-role key.
