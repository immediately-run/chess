import { LEVELS } from '../lib/engine';
import { deriveStatus, isMyMove, openSeatFor, seatHolder, seatLabel } from '../lib/rules';
import type { GameFiles } from '../lib/types';

interface Props {
  game: GameFiles;
  me: string;
  onOpen: () => void;
  onDelete?: () => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** One line in a games list: players, progress, and what you can do. */
function GameRow({ game, me, onOpen, onDelete }: Props) {
  const status = deriveStatus(game);
  const w = seatLabel(seatHolder(game, 'w'));
  const b = seatLabel(seatHolder(game, 'b'));
  const claim = openSeatFor(game, me);
  const mine = isMyMove(game, me, status);
  let chip: { text: string; cls: string };
  let action = 'Open';
  if (status.over) {
    chip = { text: status.result ?? 'Finished', cls: 'chip' };
    action = 'Review';
  } else if (claim) {
    chip = { text: 'Open seat', cls: 'chip chip-open' };
    action = `Join as ${claim === 'w' ? 'White' : 'Black'}`;
  } else if (mine) {
    chip = { text: 'Your move', cls: 'chip chip-hot' };
    action = 'Play';
  } else if (game.meta.mode === 'correspondence') {
    chip = { text: seatHolder(game, 'w') === 'open' || seatHolder(game, 'b') === 'open' ? 'Waiting for a player' : 'Their move', cls: 'chip chip-wait' };
  } else {
    chip = { text: 'In progress', cls: 'chip chip-wait' };
    action = 'Resume';
  }
  const detail =
    game.meta.mode === 'engine'
      ? `Engine · ${LEVELS[game.meta.level ?? 2].name}`
      : game.meta.mode === 'local'
        ? 'Two players'
        : 'Correspondence';
  return (
    <li className="game-row">
      <button type="button" className="game-main" onClick={onOpen}>
        <span className="game-players">
          <span className="seat seat-w">{w}</span>
          <span className="vs">vs</span>
          <span className="seat seat-b">{b}</span>
        </span>
        <span className="game-meta mono">
          {detail} · {game.moves.length} {game.moves.length === 1 ? 'ply' : 'plies'} · {when(game.meta.created)}
        </span>
      </button>
      <span className={chip.cls}>{chip.text}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen}>
        {action}
      </button>
      {onDelete && (
        <button type="button" className="iconbtn" onClick={onDelete} aria-label="Delete game" title="Delete">
          ✕
        </button>
      )}
    </li>
  );
}

export default GameRow;
