# Chess

Correspondence chess without a server: every move is a file in a shared space.
Play a friend, or the built-in engine.

An example app for [immediately.run](https://immediately.run) — React +
TypeScript, loaded straight from GitHub and transpiled in the browser. The only
runtime dependency besides React and the SDK is [chess.js](https://github.com/jhlywa/chess.js)
(rules, check/mate/draw detection, SAN, PGN, FEN), vendored as
`src/vendor/chess.js` with its BigInt literals spelled `BigInt("…")` — the
immediately.run sandbox mangles `123n` literals inside `node_modules`.

## Try it

Open it on immediately.run:

<https://immediately.run/present/github/immediately-run/chess/main/files/src/App.tsx>

- **Play the engine** — three levels (Casual / Club / Strong), play as White,
  Black or random. The engine is a small negamax search with alpha-beta,
  material + piece-square tables, and a captures-only quiescence at the top
  level. It runs in `setTimeout` slices so the page never freezes (the sandbox
  has no Web Workers).
- **Two players, one device** — pass the phone; the board turns to face whoever
  is to move.
- **Correspondence** — create or open a shared space, start a game as White or
  Black, and the other seat stays open until a member of the space joins it.
  Moves land as files; the app polls the space every 3 s while you wait. Resign
  and draw offers work the same way.

The board is plain SVG: tap a piece, tap a highlighted target. Promotions get a
picker, the move list is clickable to review earlier positions, captured
pieces and the material edge sit next to each player, and the PGN is one click
away.

## How data is stored

Everything is a file under the app's storage, one record per file so that
several people can write a game without clobbering each other (writes are
last-write-wins per file).

```
<root>/games/<gameId>/game.json         written once by the creator: id, mode,
                                         white, black ('open' | 'engine' | login), created
<root>/games/<gameId>/seat-black.json   claim of an open seat ({ login, at }); also seat-white.json
<root>/games/<gameId>/moves/0001.json   one file per half-move: { n, san, fen (after), by, at }
<root>/games/<gameId>/resign-white.json { by, at }; also resign-black.json
<root>/games/<gameId>/draw-white.json   draw offer { by, at, ply }; also draw-black.json
```

- Solo games (engine, local) live in the user's **private** app storage
  (`openSettings()` in the SDK), under `data/games/…`. They show up in the
  lobby's "Your games" list for resuming.
- Correspondence games live in a **shared space** under `chess/games/…`. The
  chosen space id is remembered in the private `data/config.json` and
  re-mounted at boot with no prompt.
- The result is never written to `game.json`; it is **derived** from the
  files: a resignation, an agreed draw (both offers carry the same ply), or
  what chess.js says about the last position (mate, stalemate, insufficient
  material, repetition, fifty moves).
- A draw offer is valid only for the ply it was made at — moving instead of
  accepting lets it lapse, no extra file needed.
- Joining a game writes `seat-black.json` (or `seat-white.json`) instead of
  rewriting `game.json`, so a join can never race the creator's file.

### Multi-user notes

- It is your move only when your login holds the side to move and the last
  move file was written by the opponent.
- The app cannot invite anyone: share the space itself from the Spaces page on
  immediately.run. Members with a read-only grant can watch but not move.
- Spaces have no live change events, so the game screen polls the game's
  directories every 3 s and the lobby re-reads the games list every 6 s.
- When the host does not report a login (local dev, some hosts), the lobby
  asks for a display name, saved privately, and uses it as the seat holder.

## Local development

```bash
npm install
npm run dev      # vite dev; the fs writes to ./devfs-playground (git-ignored)
npm run build    # tsc + vite build
npm run lint     # eslint, incl. the React Fast Refresh rule
```

Under `vite dev` there is no host: private storage maps to
`devfs-playground/settings/…` and "Create a shared space" maps to
`devfs-playground/shared/…`, so you can simulate an opponent by dropping move
files into the game directory from another terminal.

To run against the real platform without committing, use the CLI:
`immediately.run dev . --origin https://local.immediately.run`.

## License

MIT — see [LICENSE](./LICENSE).
