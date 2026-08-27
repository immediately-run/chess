// On-disk layout of a game, on top of the fs helpers in store.ts:
//
//   <root>/games/<gameId>/game.json          (written once)
//   <root>/games/<gameId>/seat-black.json    (claim of an open seat; also seat-white)
//   <root>/games/<gameId>/moves/0001.json    (one file per half-move)
//   <root>/games/<gameId>/resign-white.json  (also resign-black)
//   <root>/games/<gameId>/draw-white.json    (draw offer; also draw-black)
//
// Nothing is ever rewritten except a player's OWN draw-offer file, so concurrent
// writers in a shared space can never clobber each other's records.
import fs from 'fs';
import { ensureDir, listFiles, newId, readJson, removeFile, writeJson } from './store';
import type { Store } from './store';
import type {
  Color,
  DrawOffer,
  EngineLevel,
  GameFiles,
  GameMeta,
  GameMode,
  MoveRecord,
  Resignation,
  Seat,
  SeatClaim,
} from './types';
import { ENGINE_SEAT, OPEN_SEAT } from './types';

const colorName = (c: Color) => (c === 'w' ? 'white' : 'black');

export const gamesDir = (store: Store) => `${store.root}/games`;
export const gameDir = (store: Store, id: string) => `${store.root}/games/${id}`;
export const movesDir = (store: Store, id: string) => `${gameDir(store, id)}/moves`;

const pad = (n: number) => String(n).padStart(4, '0');

export interface NewGameOptions {
  mode: GameMode;
  /** Which seat the creator takes. */
  myColor: Color;
  me: string;
  level?: EngineLevel;
}

/** Create a game directory with its `game.json`. Returns the meta. */
export async function createGame(store: Store, opts: NewGameOptions): Promise<GameMeta> {
  const id = newId();
  const other: Seat =
    opts.mode === 'engine' ? ENGINE_SEAT : opts.mode === 'local' ? opts.me : OPEN_SEAT;
  const meta: GameMeta = {
    id,
    mode: opts.mode,
    white: opts.myColor === 'w' ? opts.me : other,
    black: opts.myColor === 'b' ? opts.me : other,
    created: new Date().toISOString(),
    createdBy: opts.me,
    result: null,
  };
  if (opts.level) meta.level = opts.level;
  await ensureDir(movesDir(store, id));
  await writeJson(`${gameDir(store, id)}/game.json`, meta);
  return meta;
}

/** Read every file of one game. Returns null when `game.json` is missing. */
export async function readGame(store: Store, id: string): Promise<GameFiles | null> {
  const dir = gameDir(store, id);
  const meta = await readJson<GameMeta | null>(`${dir}/game.json`, null);
  if (!meta) return null;
  const [moves, sw, sb, rw, rb, dw, db] = await Promise.all([
    readMoves(store, id),
    readJson<SeatClaim | null>(`${dir}/seat-white.json`, null),
    readJson<SeatClaim | null>(`${dir}/seat-black.json`, null),
    readJson<Resignation | null>(`${dir}/resign-white.json`, null),
    readJson<Resignation | null>(`${dir}/resign-black.json`, null),
    readJson<DrawOffer | null>(`${dir}/draw-white.json`, null),
    readJson<DrawOffer | null>(`${dir}/draw-black.json`, null),
  ]);
  return { meta, moves, seats: { w: sw, b: sb }, resigns: { w: rw, b: rb }, draws: { w: dw, b: db } };
}

/** Moves in play order. Tolerates a half-written trailing file (skips gaps). */
export async function readMoves(store: Store, id: string): Promise<MoveRecord[]> {
  const dir = movesDir(store, id);
  const names = await listFiles(dir, '.json');
  const recs = await Promise.all(names.map((n) => readJson<MoveRecord | null>(`${dir}/${n}`, null)));
  const out: MoveRecord[] = [];
  for (const r of recs.sort((a, b) => (a?.n ?? 0) - (b?.n ?? 0))) {
    if (!r || typeof r.san !== 'string' || typeof r.fen !== 'string') continue;
    if (r.n !== out.length + 1) break; // a gap: stop at the last contiguous move
    out.push(r);
  }
  return out;
}

/** Append half-move number `n` (1-based). The file name is the ply so two
 *  writers can never disagree about which move is which. */
export async function writeMove(store: Store, id: string, rec: MoveRecord): Promise<void> {
  await writeJson(`${movesDir(store, id)}/${pad(rec.n)}.json`, rec);
}

export async function claimSeat(store: Store, id: string, color: Color, login: string): Promise<void> {
  const claim: SeatClaim = { login, at: new Date().toISOString() };
  await writeJson(`${gameDir(store, id)}/seat-${colorName(color)}.json`, claim);
}

export async function resign(store: Store, id: string, color: Color, by: string): Promise<void> {
  const rec: Resignation = { by, at: new Date().toISOString() };
  await writeJson(`${gameDir(store, id)}/resign-${colorName(color)}.json`, rec);
}

export async function offerDraw(store: Store, id: string, color: Color, by: string, ply: number): Promise<void> {
  const rec: DrawOffer = { by, at: new Date().toISOString(), ply };
  await writeJson(`${gameDir(store, id)}/draw-${colorName(color)}.json`, rec);
}

export async function withdrawDraw(store: Store, id: string, color: Color): Promise<void> {
  await removeFile(`${gameDir(store, id)}/draw-${colorName(color)}.json`);
}

/** Ids of all games in a store, newest first (ids are time-sortable). */
export async function listGameIds(store: Store): Promise<string[]> {
  const names = await listFiles(gamesDir(store));
  return names.sort().reverse();
}

/** Read every game in a store (for the lists). Skips unreadable directories. */
export async function listGames(store: Store): Promise<GameFiles[]> {
  const ids = await listGameIds(store);
  const games = await Promise.all(ids.map((id) => readGame(store, id)));
  return games.filter((g): g is GameFiles => g !== null);
}

/** Delete a whole game directory (private store only). */
export async function deleteGame(store: Store, id: string): Promise<void> {
  const mdir = movesDir(store, id);
  for (const n of await listFiles(mdir)) await removeFile(`${mdir}/${n}`);
  const dir = gameDir(store, id);
  for (const n of await listFiles(dir)) await removeFile(`${dir}/${n}`);
  try {
    await fs.promises.rmdir(mdir);
    await fs.promises.rmdir(dir);
  } catch {
    /* leave an empty dir behind if rmdir is unsupported */
  }
}
