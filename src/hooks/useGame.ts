// One game, live: reads its files, polls the shared space for the opponent's
// writes, and exposes the write actions (move, claim seat, resign, draw).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chess } from '../vendor/chess';
import { claimSeat, gameDir, movesDir, offerDraw, readGame, resign, withdrawDraw, writeMove } from '../lib/games';
import { deriveStatus, isMyMove, myColors, openSeatFor, replay } from '../lib/rules';
import type { Status } from '../lib/rules';
import { pollDir } from '../lib/store';
import type { Store } from '../lib/store';
import type { Color, GameFiles, MoveRecord } from '../lib/types';

export interface PlayInput {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  /** Who made it (login, 'engine', or a color for local games). */
  by: string;
}

export interface LiveGame {
  game: GameFiles | null;
  chess: Chess | null;
  status: Status | null;
  loading: boolean;
  missing: boolean;
  error: string | null;
  mine: Color[];
  myMove: boolean;
  claimable: Color | null;
  reload: () => Promise<void>;
  play: (input: PlayInput) => Promise<boolean>;
  claim: (color: Color) => Promise<void>;
  resignAs: (color: Color) => Promise<void>;
  offerDrawAs: (color: Color) => Promise<void>;
  withdrawDrawAs: (color: Color) => Promise<void>;
}

const POLL_MS = 3000;

export function useGame(store: Store | null, id: string | null, me: string): LiveGame {
  const [game, setGame] = useState<GameFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameRef = useRef<GameFiles | null>(null);
  const writing = useRef(false);

  const reload = useCallback(async () => {
    if (!store || !id) return;
    try {
      const g = await readGame(store, id);
      if (!g) {
        setMissing(true);
        return;
      }
      // Never let a poll roll back a move we just wrote and are still flushing.
      const cur = gameRef.current;
      if (cur && cur.meta.id === g.meta.id && g.moves.length < cur.moves.length && writing.current) return;
      gameRef.current = g;
      setGame(g);
      setMissing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the game.');
    } finally {
      setLoading(false);
    }
  }, [store, id]);

  // Initial load + live polling (only shared stores have other writers).
  useEffect(() => {
    if (!store || !id) return;
    let cancelled = false;
    gameRef.current = null;
    (async () => {
      await reload();
    })();
    const stops: (() => void)[] = [];
    if (store.spaceId) {
      const tick = () => {
        if (!cancelled) void reload();
      };
      stops.push(pollDir(movesDir(store, id), tick, POLL_MS));
      stops.push(pollDir(gameDir(store, id), tick, POLL_MS));
    }
    return () => {
      cancelled = true;
      stops.forEach((s) => s());
    };
  }, [store, id, reload]);

  const chess = useMemo(() => (game ? replay(game.moves) : null), [game]);
  const status = useMemo(() => (game && chess ? deriveStatus(game, chess) : null), [game, chess]);
  const mine = useMemo(() => (game ? myColors(game, me) : []), [game, me]);
  const myMove = !!(game && status && isMyMove(game, me, status));
  const claimable = game ? openSeatFor(game, me) : null;

  const play = useCallback(
    async (input: PlayInput): Promise<boolean> => {
      const g = gameRef.current;
      if (!store || !id || !g || !chess) return false;
      const probe = replay(g.moves);
      let san: string;
      try {
        san = probe.move({ from: input.from, to: input.to, promotion: input.promotion }).san;
      } catch {
        return false;
      }
      const rec: MoveRecord = { n: g.moves.length + 1, san, fen: probe.fen(), by: input.by, at: new Date().toISOString() };
      const next: GameFiles = { ...g, moves: [...g.moves, rec] };
      gameRef.current = next;
      setGame(next);
      writing.current = true;
      try {
        await writeMove(store, id, rec);
        setError(null);
        return true;
      } catch (e) {
        gameRef.current = g;
        setGame(g);
        setError(e instanceof Error ? e.message : 'Could not save the move.');
        return false;
      } finally {
        writing.current = false;
      }
    },
    [store, id, chess],
  );

  const wrap = useCallback(
    (fn: (store: Store, id: string) => Promise<void>, fallback: string) => async () => {
      if (!store || !id) return;
      try {
        await fn(store, id);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : fallback);
      }
    },
    [store, id, reload],
  );

  const claim = useCallback(
    (color: Color) => wrap((s, i) => claimSeat(s, i, color, me), 'Could not join.')(),
    [wrap, me],
  );
  const resignAs = useCallback(
    (color: Color) => wrap((s, i) => resign(s, i, color, me || color), 'Could not resign.')(),
    [wrap, me],
  );
  const offerDrawAs = useCallback(
    (color: Color) =>
      wrap((s, i) => offerDraw(s, i, color, me || color, gameRef.current?.moves.length ?? 0), 'Could not offer a draw.')(),
    [wrap, me],
  );
  const withdrawDrawAs = useCallback(
    (color: Color) => wrap((s, i) => withdrawDraw(s, i, color), 'Could not withdraw.')(),
    [wrap],
  );

  return {
    game,
    chess,
    status,
    loading,
    missing,
    error,
    mine,
    myMove,
    claimable,
    reload,
    play,
    claim,
    resignAs,
    offerDrawAs,
    withdrawDrawAs,
  };
}
