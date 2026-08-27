import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chess } from '../vendor/chess';
import type { Square } from '../vendor/chess';
import Board from './Board';
import type { LegalTarget } from './Board';
import Captured from './Captured';
import MoveList from './MoveList';
import PromotionPicker from './PromotionPicker';
import { useEngine } from '../hooks/useEngine';
import { useGame } from '../hooks/useGame';
import { LEVELS, evaluate } from '../lib/engine';
import type { EngineMove } from '../lib/engine';
import { captured, colorLabel, engineColor, fenAt, other, resultLine, seatHolder, seatLabel } from '../lib/rules';
import type { Store } from '../lib/store';
import type { Color, EngineLevel, GameMode } from '../lib/types';

interface Props {
  store: Store;
  id: string;
  me: string;
  onBack: () => void;
  /** Start another game with the same settings, colors swapped. */
  onRematch: (opts: { mode: GameMode; myColor: Color; level?: EngineLevel }) => void;
}

/** A game in play (or under review): board, status, moves, actions. */
function GameScreen({ store, id, me, onBack, onRematch }: Props) {
  const live = useGame(store, id, me);
  const { game, chess, status, mine, myMove, claimable } = live;
  // Selection + promotion are keyed by ply so a new move (ours, the engine's,
  // or an opponent's arriving by poll) silently invalidates them.
  const [sel, setSel] = useState<{ ply: number; square: string } | null>(null);
  const [promoSel, setPromoSel] = useState<{ ply: number; from: string; to: string } | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const mode = game?.meta.mode;
  const engCol = game ? engineColor(game.meta) : null;
  const level = game?.meta.level ?? 2;
  const turn = status?.turn ?? 'w';
  const moves = game?.moves ?? [];
  const plies = moves.length;
  const selected = sel && sel.ply === plies ? sel.square : null;
  const promo = promoSel && promoSel.ply === plies ? promoSel : null;
  const setSelected = useCallback((square: string | null) => setSel(square ? { ply: plies, square } : null), [plies]);
  const setPromo = useCallback(
    (p: { from: string; to: string } | null) => setPromoSel(p ? { ply: plies, ...p } : null),
    [plies],
  );
  const reviewing = viewPly !== null && viewPly < moves.length;
  const shownFen = chess ? (reviewing ? fenAt(moves, viewPly) : chess.fen()) : null;

  // Which way up: my color, or the side to move for pass-the-phone games.
  const base: Color = mode === 'local' ? turn : mine.length === 1 ? mine[0] : 'w';
  const orientation: Color = flipped ? other(base) : base;

  const interactive = !!chess && !!status && !status.over && myMove && !reviewing && !promo && store.mode !== 'ro';

  // The engine moves when it is its turn.
  const engineActive = !!game && !!status && mode === 'engine' && !status.over && engCol === turn && store.mode !== 'ro';
  const onEngineMove = useCallback(
    (m: EngineMove) => {
      void live.play({ from: m.from, to: m.to, promotion: m.promotion, by: 'engine' });
    },
    [live],
  );
  useEngine({ active: engineActive, fen: engineActive && chess ? chess.fen() : null, level, onMove: onEngineMove });

  const targets: LegalTarget[] = useMemo(() => {
    if (!chess || !selected || !interactive) return [];
    return chess.moves({ square: selected as Square, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured }));
  }, [chess, selected, interactive]);

  const byLabel = mode === 'engine' ? me || 'you' : mode === 'local' ? colorLabel(turn) : me;

  const onTap = useCallback(
    (square: string) => {
      if (!chess || !interactive) return;
      if (selected && selected !== square) {
        const legal = chess.moves({ square: selected as Square, verbose: true }).filter((m) => m.to === square);
        if (legal.length > 0) {
          if (legal.some((m) => m.promotion)) {
            setPromo({ from: selected, to: square });
            return;
          }
          setSelected(null);
          void live.play({ from: selected, to: square, by: byLabel });
          return;
        }
      }
      const piece = chess.get(square as Square);
      setSelected(piece && piece.color === turn && selected !== square ? square : null);
    },
    [chess, interactive, selected, live, byLabel, turn, setPromo, setSelected],
  );

  const pickPromotion = (p: 'q' | 'r' | 'b' | 'n') => {
    if (!promo) return;
    const { from, to } = promo;
    setPromo(null);
    setSelected(null);
    void live.play({ from, to, promotion: p, by: byLabel });
  };

  // Draw handling per mode.
  const myColor: Color | null = mine.length === 1 ? mine[0] : mine.length === 2 ? turn : null;
  const theirOffer = game && myColor ? game.draws[other(myColor)] : null;
  const theirOfferLive = !!theirOffer && theirOffer.ply === plies;
  const myOffer = game && myColor ? game.draws[myColor] : null;
  const myOfferLive = !!myOffer && myOffer.ply === plies;

  const onDraw = async () => {
    if (!game || !myColor || !chess) return;
    if (mode === 'local') {
      await live.offerDrawAs('w');
      await live.offerDrawAs('b');
      return;
    }
    if (mode === 'engine' && engCol) {
      // The engine takes a draw when it is not ahead.
      const evalForEngine = chess.turn() === engCol ? evaluate(chess.fen()) : -evaluate(chess.fen());
      if (evalForEngine <= 0) {
        await live.offerDrawAs(myColor);
        await live.offerDrawAs(engCol);
      } else setNote('The engine declines the draw.');
      return;
    }
    await live.offerDrawAs(myColor);
  };

  const onResign = async () => {
    if (!myColor) return;
    if (!confirmResign) {
      setConfirmResign(true);
      return;
    }
    setConfirmResign(false);
    await live.resignAs(myColor);
  };

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(t);
  }, [note]);

  if (live.missing) {
    return (
      <main className="game">
        <p className="error">This game no longer exists.</p>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Back to the lobby
        </button>
      </main>
    );
  }
  if (!game || !chess || !status || !shownFen) {
    return (
      <main className="game">
        <p className="muted">Loading game…</p>
      </main>
    );
  }

  const lastMove = (() => {
    const ply = reviewing ? viewPly : plies;
    if (!ply) return null;
    const probe = new Chess(fenAt(moves, ply - 1));
    try {
      const m = probe.move(moves[ply - 1].san);
      return { from: m.from, to: m.to };
    } catch {
      return null;
    }
  })();
  const checkSquare = (() => {
    if (reviewing || !status.inCheck) return null;
    const board = chess.board();
    for (const row of board) for (const sq of row) if (sq && sq.type === 'k' && sq.color === turn) return sq.square;
    return null;
  })();

  const wName = seatLabel(seatHolder(game, 'w'));
  const bName = seatLabel(seatHolder(game, 'b'));
  const cap = captured(shownFen);

  let headline: string;
  if (status.over) headline = resultLine(status, game);
  else if (reviewing) headline = `Reviewing move ${Math.ceil(viewPly / 2)} · ${viewPly} of ${plies} plies`;
  else if (claimable) headline = `Seat open — join as ${colorLabel(claimable)}`;
  else if (engineActive) headline = 'Engine is thinking…';
  else if (myMove) headline = mode === 'local' ? `${colorLabel(turn)} to move` : status.inCheck ? 'Your move — you are in check' : 'Your move';
  else if (mine.length === 0) headline = `${colorLabel(turn)} to move · you are watching`;
  else headline = `Waiting for ${colorLabel(turn) === 'White' ? wName : bName}…`;

  const playerCard = (c: Color) => {
    const name = c === 'w' ? wName : bName;
    const sub = mode === 'engine' && c === engCol ? LEVELS[level].name : mine.includes(c) && mode !== 'local' && name !== 'you' ? 'you' : '';
    return (
      <div className={`player player-${c}${!status.over && turn === c ? ' player-turn' : ''}`}>
        <span className={`swatch swatch-${c}`} aria-hidden />
        <span className="player-name">{name}</span>
        {sub && <span className="player-sub mono">{sub}</span>}
        <Captured captured={cap} by={c} />
      </div>
    );
  };

  const modeLabel = mode === 'engine' ? `Engine · ${LEVELS[level].name}` : mode === 'local' ? 'Two players' : 'Correspondence';

  return (
    <main className={`game game-${mode}`}>
      <div className="board-col">
        {playerCard(other(orientation))}
        <div className="board-wrap">
          <Board
            fen={shownFen}
            orientation={orientation}
            selected={selected}
            targets={targets}
            lastMove={lastMove}
            check={checkSquare}
            interactive={interactive}
            onTap={onTap}
          />
          {promo && <PromotionPicker color={turn} onPick={pickPromotion} onCancel={() => setPromo(null)} />}
        </div>
        {playerCard(orientation)}
      </div>

      <aside className="panel">
        <div className="panel-head">
          <p className="headline">{headline}</p>
          <p className="muted small mono">{modeLabel}</p>
          {live.error && <p className="error">{live.error}</p>}
          {note && <p className="note">{note}</p>}
          {theirOfferLive && !status.over && mode === 'correspondence' && (
            <p className="note">{seatLabel(theirOffer.by)} offers a draw.</p>
          )}
          {myOfferLive && !status.over && mode === 'correspondence' && !theirOfferLive && (
            <p className="note">Draw offered — it lapses if they move.</p>
          )}
        </div>

        <div className="actions">
          {claimable && store.mode !== 'ro' && (
            <button type="button" className="btn btn-primary" onClick={() => void live.claim(claimable)}>
              Join as {colorLabel(claimable)}
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlipped((f) => !f)}>
            Flip board
          </button>
          {!status.over && myColor && store.mode !== 'ro' && (
            <>
              {mode === 'correspondence' && theirOfferLive ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void live.offerDrawAs(myColor)}>
                  Accept draw
                </button>
              ) : mode === 'correspondence' && myOfferLive ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void live.withdrawDrawAs(myColor)}>
                  Withdraw draw
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" disabled={!myMove && mode !== 'local'} onClick={() => void onDraw()}>
                  {mode === 'local' ? 'Agree a draw' : 'Offer draw'}
                </button>
              )}
              <button
                type="button"
                className={`btn btn-sm ${confirmResign ? 'btn-danger' : 'btn-ghost'}`}
                onClick={() => void onResign()}
                onBlur={() => setConfirmResign(false)}
              >
                {confirmResign ? `Confirm: resign as ${colorLabel(myColor)}` : 'Resign'}
              </button>
            </>
          )}
          {status.over && mode !== 'correspondence' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onRematch({ mode: game.meta.mode, myColor: mine[0] ? other(mine[0]) : 'w', level: game.meta.level })}>
              Rematch
            </button>
          )}
        </div>

        <MoveList moves={moves} viewPly={viewPly} onSelect={setViewPly} />

        <details className="pgn">
          <summary className="mono small">PGN</summary>
          <pre className="mono small">{chess.pgn() || '(no moves)'}</pre>
        </details>
      </aside>
    </main>
  );
}

export default GameScreen;
