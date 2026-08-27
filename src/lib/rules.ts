// Pure chess helpers on top of chess.js: replaying a game's move files, deriving
// the result from the files, captured pieces, seat ownership.
import { Chess } from '../vendor/chess';
import type { Color, GameFiles, GameMeta, MoveRecord } from './types';
import { ENGINE_SEAT, OPEN_SEAT } from './types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorLabel = (c: Color) => (c === 'w' ? 'White' : 'Black');

/** Replay the move records into a chess.js instance (keeps history for
 *  repetition detection). Falls back to loading the last FEN if a SAN is bad. */
export function replay(moves: MoveRecord[]): Chess {
  const chess = new Chess();
  for (const m of moves) {
    try {
      chess.move(m.san);
    } catch {
      chess.load(m.fen);
    }
  }
  return chess;
}

/** FEN of the position after `ply` half-moves (0 = start). */
export const fenAt = (moves: MoveRecord[], ply: number): string =>
  ply <= 0 ? START_FEN : (moves[Math.min(ply, moves.length) - 1]?.fen ?? START_FEN);

export type Result = '1-0' | '0-1' | '½-½';

export interface Status {
  over: boolean;
  result: Result | null;
  /** Short human reason: "Checkmate", "Stalemate", "White resigned", … */
  reason: string;
  /** Side to move (meaningful while not over). */
  turn: Color;
  inCheck: boolean;
}

/** Derive the game's status from its files: resignation and agreed draws win
 *  over the board; otherwise ask chess.js about the last position. */
export function deriveStatus(g: GameFiles, chess?: Chess): Status {
  const c = chess ?? new Chess(fenAt(g.moves, g.moves.length));
  const turn = c.turn();
  if (g.resigns.w) return { over: true, result: '0-1', reason: 'White resigned', turn, inCheck: false };
  if (g.resigns.b) return { over: true, result: '1-0', reason: 'Black resigned', turn, inCheck: false };
  if (g.draws.w && g.draws.b && g.draws.w.ply === g.draws.b.ply && g.draws.w.ply === g.moves.length)
    return { over: true, result: '½-½', reason: 'Draw agreed', turn, inCheck: false };
  if (c.isCheckmate())
    return { over: true, result: turn === 'w' ? '0-1' : '1-0', reason: 'Checkmate', turn, inCheck: true };
  if (c.isStalemate()) return { over: true, result: '½-½', reason: 'Stalemate', turn, inCheck: false };
  if (c.isInsufficientMaterial())
    return { over: true, result: '½-½', reason: 'Insufficient material', turn, inCheck: false };
  if (c.isThreefoldRepetition())
    return { over: true, result: '½-½', reason: 'Threefold repetition', turn, inCheck: false };
  if (c.isDrawByFiftyMoves()) return { over: true, result: '½-½', reason: 'Fifty-move rule', turn, inCheck: false };
  return { over: false, result: null, reason: '', turn, inCheck: c.inCheck() };
}

/** Who holds a seat, after claims: login / name, 'engine', or 'open'. */
export function seatHolder(g: GameFiles, color: Color): string {
  const base = color === 'w' ? g.meta.white : g.meta.black;
  if (base !== OPEN_SEAT) return base;
  return g.seats[color]?.login ?? OPEN_SEAT;
}

/** Display label for a seat holder. */
export function seatLabel(holder: string): string {
  if (holder === OPEN_SEAT) return 'Open seat';
  if (holder === ENGINE_SEAT) return 'Engine';
  return holder;
}

/** Colors `me` may move for in this game. */
export function myColors(g: GameFiles, me: string): Color[] {
  if (g.meta.mode === 'local') return ['w', 'b'];
  if (g.meta.mode === 'engine') return [g.meta.white === ENGINE_SEAT ? 'b' : 'w'];
  const out: Color[] = [];
  if (me && seatHolder(g, 'w') === me) out.push('w');
  if (me && seatHolder(g, 'b') === me) out.push('b');
  return out;
}

/** The seat `me` could still claim, if any. */
export function openSeatFor(g: GameFiles, me: string): Color | null {
  if (g.meta.mode !== 'correspondence' || !me) return null;
  if (seatHolder(g, 'w') === OPEN_SEAT && seatHolder(g, 'b') !== me) return 'w';
  if (seatHolder(g, 'b') === OPEN_SEAT && seatHolder(g, 'w') !== me) return 'b';
  return null;
}

/** It's `me`'s move: I hold the side to move, the game is live, and (when I
 *  hold only one seat) the last move was not mine — guards a double write while
 *  a poll is still catching up. */
export function isMyMove(g: GameFiles, me: string, status: Status): boolean {
  if (status.over) return false;
  const mine = myColors(g, me);
  if (!mine.includes(status.turn)) return false;
  if (mine.length === 2) return true;
  const last = g.moves[g.moves.length - 1];
  return !last || last.by !== me || g.meta.mode !== 'correspondence';
}

export const engineColor = (meta: GameMeta): Color | null =>
  meta.mode !== 'engine' ? null : meta.white === ENGINE_SEAT ? 'w' : 'b';

// ── material ──────────────────────────────────────────────────────────────────

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_COUNT: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

export interface Captured {
  /** Pieces White has captured (i.e. missing black pieces), most valuable first. */
  byWhite: PieceType[];
  byBlack: PieceType[];
  /** Material balance from White's view, in pawns. */
  balance: number;
}

/** Captured pieces, read off the FEN piece placement. */
export function captured(fen: string): Captured {
  const placement = fen.split(' ')[0];
  const count = { w: { ...START_COUNT }, b: { ...START_COUNT } };
  for (const ch of placement) {
    const lower = ch.toLowerCase() as PieceType;
    if (!(lower in START_COUNT)) continue;
    const side = ch === lower ? 'b' : 'w';
    count[side][lower] -= 1;
  }
  const order: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
  const missing = (side: 'w' | 'b') =>
    order.flatMap((t) => Array.from({ length: Math.max(0, count[side][t]) }, () => t));
  const byWhite = missing('b');
  const byBlack = missing('w');
  const sum = (ps: PieceType[]) => ps.reduce((a, p) => a + PIECE_VALUE[p], 0);
  return { byWhite, byBlack, balance: sum(byWhite) - sum(byBlack) };
}

/** Pretty result string for a finished game. */
export function resultLine(status: Status, g: GameFiles): string {
  if (!status.over) return '';
  const w = seatLabel(seatHolder(g, 'w'));
  const b = seatLabel(seatHolder(g, 'b'));
  if (status.result === '1-0') return `${status.reason} · ${w} wins`;
  if (status.result === '0-1') return `${status.reason} · ${b} wins`;
  return `${status.reason} · draw`;
}
