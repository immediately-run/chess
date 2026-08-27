// Shared record shapes. Every record is ONE file so several people can write a
// game without clobbering each other (last-write-wins per file).

export type GameMode = 'engine' | 'local' | 'correspondence';
export type Color = 'w' | 'b';
export type EngineLevel = 1 | 2 | 3;

/** The seat a player holds. `'open'` = nobody has joined yet. */
export type Seat = string;
export const OPEN_SEAT: Seat = 'open';
export const ENGINE_SEAT: Seat = 'engine';

/** `<store>/games/<id>/game.json` — written ONCE by the creator, never rewritten. */
export interface GameMeta {
  id: string;
  mode: GameMode;
  /** Login (or typed name) of the white player, `'open'`, or `'engine'`. */
  white: Seat;
  black: Seat;
  /** ISO timestamp. */
  created: string;
  /** Who created the game (login / name). */
  createdBy: string;
  /** Engine games only. */
  level?: EngineLevel;
  /** Result stamped by the creator at creation time is always null; the live
   *  result is DERIVED from the move / resign / draw files (see rules.ts). */
  result: null;
}

/** `<game>/moves/NNNN.json` — one file per half-move. */
export interface MoveRecord {
  n: number;
  san: string;
  /** FEN after the move. */
  fen: string;
  by: string;
  at: string;
}

/** `<game>/seat-<color>.json` — claims an `'open'` seat. */
export interface SeatClaim {
  login: string;
  at: string;
}

/** `<game>/resign-<color>.json` */
export interface Resignation {
  by: string;
  at: string;
}

/** `<game>/draw-<color>.json` — a draw offer, valid for the ply it was made at.
 *  A draw is agreed when both colors' offers carry the same ply. */
export interface DrawOffer {
  by: string;
  at: string;
  ply: number;
}

/** Everything on disk for one game, as last read. */
export interface GameFiles {
  meta: GameMeta;
  moves: MoveRecord[];
  seats: { w: SeatClaim | null; b: SeatClaim | null };
  resigns: { w: Resignation | null; b: Resignation | null };
  draws: { w: DrawOffer | null; b: DrawOffer | null };
}

/** `<private>/config.json` */
export interface Config {
  /** Remembered shared space (re-mounted at boot without a prompt). */
  spaceId?: string;
  spaceName?: string;
  /** Display name when the host does not tell us the login. */
  name?: string;
  /** Last engine settings, so "Play the engine" remembers them. */
  level?: EngineLevel;
  playAs?: Color | 'random';
}
