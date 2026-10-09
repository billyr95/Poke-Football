# PokeFootball

Draft Pokémon onto football teams with friends, then play a full season with standings, playoffs and a championship.
Ratings come from real base stats, height, weight and evolution stage, all pulled from [PokeAPI](https://pokeapi.co/docs/v2).

Built with Next.js, Tailwind and shadcn/ui.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Custom sprites (optional)

Player badges show the National Dex number by default. To show images from your own sprite API, copy
`.env.example` to `.env.local` and set a URL template, then restart `npm run dev`:

```bash
NEXT_PUBLIC_SPRITE_URL=https://your-sprite-api.example.com/sprites/{id}.png
```

Placeholders: `{id}` (25), `{id3}` (025), `{name}` (lowercase slug, e.g. `mr-mime`). If an image fails to load,
that badge falls back to the number.

## How a league works

1. **Host**: pick a username and click *Create league*. You get a 6-character code.
2. **Friends**: open the site, pick a username, and enter the code.
3. The host picks generations, whether legendaries are in, the number of teams (AI fills empty seats) and the draft order.
4. Draft 22 players each (11 offense, 11 defense), then the host plays the season week by week.

Multiplayer is peer-to-peer (PeerJS/WebRTC). **The host's browser runs the league**, so the host keeps their tab open.
If anyone refreshes, they reconnect automatically. The host's league is saved in their browser.

## Code map

| Path | What it does |
| --- | --- |
| `scripts/build-dex.mts` | Pulls all 1,025 Pokémon from PokeAPI into `src/data/dex.json` (`npm run build:dex`) |
| `src/lib/game/ratings.ts` | Attributes, position ratings, natural positions, legendary lift |
| `src/lib/game/chemistry.ts` | Type stacks per unit, QB connections, evolution lines |
| `src/lib/game/draft.ts` | Draft order, AI picks, team ratings and grades |
| `src/lib/game/sim.ts` | Snap-by-snap game sim, schedule, standings, playoffs, awards |
| `src/lib/game/league.ts` | Lobby, settings, invite codes, saving |
| `src/lib/game/net.ts` | Host/guest connections |
| `src/lib/game/store.tsx` | React state: ties the league, network and AI together |
| `src/components/game/*` | Screens: home, lobby, draft room, review, season |

To re-tune ratings, edit the constants at the top of `ratings.ts` and `chemistry.ts`. The in-app
"How ratings work" panel is generated from those same constants.

## Deploy

The app is fully static, so it runs on Vercel or Netlify with the default Next.js settings. No environment variables are needed.

Pokémon data comes from PokeAPI. This is a fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company.
