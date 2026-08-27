// A small chess engine: negamax with alpha-beta over material + piece-square
// tables. The root loop yields to the event loop between root moves (setTimeout)
// so the UI never freezes — no Web Workers (they don't exist in the sandbox).
import { Chess } from '../vendor/chess';
import type { Move } from '../vendor/chess';
import type { Color, EngineLevel } from './types';

export interface EngineMove {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  san: string;
  /** Score from the mover's view, centipawns. */
  score: number;
  nodes: number;
}

export const LEVELS: Record<EngineLevel, { name: string; depth: number; noise: number; blurb: string }> = {
  1: { name: 'Casual', depth: 1, noise: 120, blurb: 'Looks one move ahead and makes mistakes.' },
  2: { name: 'Club', depth: 2, noise: 20, blurb: 'Two plies deep, solid tactics.' },
  3: { name: 'Strong', depth: 3, noise: 0, blurb: 'Three plies with quiescent captures. Takes a moment.' },
};

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables from White's perspective, rank 8 first (index 0 = a8).
// prettier-ignore
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

const MATE = 100_000;

/** Static evaluation from the side-to-move's view, parsed straight off a FEN.
 *  (Used outside the search: draw decisions, and the public-API fallback.) */
export function evaluate(fen: string): number {
  const [placement, turn] = fen.split(' ');
  let score = 0;
  let idx = 0; // 0 = a8
  for (const ch of placement) {
    if (ch === '/') continue;
    const d = ch.charCodeAt(0) - 48;
    if (d >= 1 && d <= 8) {
      idx += d;
      continue;
    }
    const lower = ch.toLowerCase();
    const white = ch !== lower;
    const pst = PST[lower];
    const sq = white ? idx : (7 - Math.floor(idx / 8)) * 8 + (idx % 8); // mirror for black
    const v = VALUE[lower] + (pst ? pst[sq] : 0);
    score += white ? v : -v;
    idx += 1;
  }
  return turn === 'w' ? score : -score;
}

// ── fast access to chess.js internals ─────────────────────────────────────────
// The public `moves({ verbose: true })` computes SAN, `before`/`after` FENs and
// check/mate suffixes for EVERY generated move — ~30× the cost of generation.
// chess.js itself reaches into these private members (see its Move class), and
// the dependency is pinned exactly (1.4.0) so the shape is known. If they ever go
// missing we fall back to the slow public path so the engine still plays.
interface InternalMove {
  color: Color;
  from: number; // 0x88 index
  to: number;
  piece: string;
  captured?: string;
  promotion?: string;
  flags: number;
}
interface Internals {
  _moves(opts?: { legal?: boolean }): InternalMove[];
  _makeMove(m: InternalMove): void;
  _undoMove(): InternalMove | null;
  _isKingAttacked(color: Color): boolean;
  _board: ({ color: Color; type: string } | undefined)[];
  _turn: Color;
}
const internals = (c: Chess): Internals | null => {
  const i = c as unknown as Partial<Internals>;
  return typeof i._moves === 'function' && typeof i._makeMove === 'function' && Array.isArray(i._board) ? (i as Internals) : null;
};
const FILES = 'abcdefgh';
const algebraic = (sq: number) => `${FILES[sq & 7]}${8 - (sq >> 4)}`;

/** Static evaluation from the side-to-move's view, straight off the 0x88 board. */
function evaluateBoard(i: Internals): number {
  let score = 0;
  const board = i._board;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = board[sq];
    if (!p) continue;
    const idx = (sq >> 4) * 8 + (sq & 7); // 0 = a8
    const pst = PST[p.type];
    const white = p.color === 'w';
    const v = VALUE[p.type] + (pst ? pst[white ? idx : (7 - (idx >> 3)) * 8 + (idx & 7)] : 0);
    score += white ? v : -v;
  }
  return i._turn === 'w' ? score : -score;
}

const orderInternal = (moves: InternalMove[]): InternalMove[] =>
  moves
    .map((m) => ({ m, key: (m.captured ? 10 * VALUE[m.captured] - VALUE[m.piece] : 0) + (m.promotion ? 800 : 0) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.m);

interface Ctx {
  i: Internals;
  nodes: number;
}

/** Captures-only search so the horizon doesn't hand away pieces. */
function quiesce(ctx: Ctx, alpha: number, beta: number, depth: number): number {
  ctx.nodes += 1;
  const stand = evaluateBoard(ctx.i);
  if (stand >= beta || depth === 0) return stand;
  if (stand > alpha) alpha = stand;
  const caps = orderInternal(ctx.i._moves({ legal: true }).filter((m) => m.captured));
  for (const m of caps) {
    ctx.i._makeMove(m);
    const s = -quiesce(ctx, -beta, -alpha, depth - 1);
    ctx.i._undoMove();
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

function negamax(ctx: Ctx, depth: number, alpha: number, beta: number, quiet: boolean): number {
  ctx.nodes += 1;
  const moves = ctx.i._moves({ legal: true });
  if (moves.length === 0) return ctx.i._isKingAttacked(ctx.i._turn) ? -MATE - depth : 0;
  if (depth === 0) return quiet ? quiesce(ctx, alpha, beta, 3) : evaluateBoard(ctx.i);
  let best = -Infinity;
  for (const m of orderInternal(moves)) {
    ctx.i._makeMove(m);
    const s = -negamax(ctx, depth - 1, -beta, -alpha, quiet);
    ctx.i._undoMove();
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

/** Public-API fallback: no search, just a one-ply material pick. */
function slowPick(chess: Chess): Move | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  let best: { m: Move; s: number } | null = null;
  for (const m of moves) {
    chess.move(m);
    const s = -evaluate(chess.fen()) + (Math.random() - 0.5) * 30;
    chess.undo();
    if (!best || s > best.s) best = { m, s };
  }
  return best?.m ?? null;
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export interface SearchHandle {
  promise: Promise<EngineMove | null>;
  cancel: () => void;
}

/** Pick a move for the side to move in `fen`. Resolves null if cancelled or no
 *  legal move exists. Yields between root moves so rendering keeps up. */
export function findBestMove(fen: string, level: EngineLevel): SearchHandle {
  let cancelled = false;
  const cfg = LEVELS[level];
  const promise = (async (): Promise<EngineMove | null> => {
    const chess = new Chess(fen);
    const i = internals(chess);
    if (!i) {
      const m = slowPick(chess);
      return m ? { from: m.from, to: m.to, promotion: m.promotion as EngineMove['promotion'], san: m.san, score: 0, nodes: 0 } : null;
    }
    const ctx: Ctx = { i, nodes: 0 };
    const root = orderInternal(i._moves({ legal: true }));
    if (root.length === 0) return null;
    let best: { m: InternalMove; s: number } | null = null;
    let alpha = -Infinity;
    const quiet = level === 3;
    let sinceYield = 0;
    for (const m of root) {
      if (cancelled) return null;
      i._makeMove(m);
      let s = -negamax(ctx, cfg.depth - 1, -Infinity, -alpha, quiet);
      i._undoMove();
      if (cfg.noise) s += (Math.random() - 0.5) * 2 * cfg.noise;
      if (!best || s > best.s) {
        best = { m, s };
        // Keep a window for the noisy levels so they still consider "worse" moves.
        if (!cfg.noise) alpha = Math.max(alpha, s);
      }
      sinceYield += 1;
      if (sinceYield >= 2 || cfg.depth >= 3) {
        sinceYield = 0;
        await yieldToUi();
      }
    }
    if (!best || cancelled) return null;
    const promotion = best.m.promotion as EngineMove['promotion'];
    const played = chess.move({ from: algebraic(best.m.from), to: algebraic(best.m.to), promotion });
    return { from: played.from, to: played.to, promotion, san: played.san, score: Math.round(best.s), nodes: ctx.nodes };
  })();
  return { promise, cancel: () => (cancelled = true) };
}

/** Pick the color the engine plays, given the user's preference. */
export const engineSide = (playAs: Color | 'random'): Color =>
  playAs === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : playAs === 'w' ? 'b' : 'w';
