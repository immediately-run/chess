import Piece from './Piece';
import type { PieceType } from '../lib/rules';
import type { Color } from '../lib/types';

const FILES = 'abcdefgh';
const S = 100; // square side in SVG units
const PIECE_NAME: Record<PieceType, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export interface LegalTarget {
  to: string;
  capture: boolean;
}

interface Props {
  fen: string;
  /** Which color sits at the bottom. */
  orientation: Color;
  selected: string | null;
  targets: LegalTarget[];
  lastMove: { from: string; to: string } | null;
  /** Square of a king in check, if any. */
  check: string | null;
  interactive: boolean;
  onTap: (square: string) => void;
}

interface Placed {
  square: string;
  type: PieceType;
  color: Color;
}

function parse(fen: string): Placed[] {
  const out: Placed[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      const d = ch.charCodeAt(0) - 48;
      if (d >= 1 && d <= 8) {
        f += d;
        continue;
      }
      const lower = ch.toLowerCase() as PieceType;
      out.push({ square: `${FILES[f]}${8 - r}`, type: lower, color: ch === lower ? 'b' : 'w' });
      f += 1;
    }
  });
  return out;
}

/** The board as an 8×8 SVG. Tap a piece, then tap a highlighted target. */
function Board({ fen, orientation, selected, targets, lastMove, check, interactive, onTap }: Props) {
  const pos = (square: string) => {
    const f = FILES.indexOf(square[0]);
    const r = Number(square[1]) - 1;
    const x = orientation === 'w' ? f : 7 - f;
    const y = orientation === 'w' ? 7 - r : r;
    return { x: x * S, y: y * S };
  };
  const pieces = parse(fen);
  const pieceAt = new Map(pieces.map((p) => [p.square, p]));
  const targetMap = new Map(targets.map((t) => [t.to, t.capture]));

  const squares: { name: string; dark: boolean }[] = [];
  for (let r = 8; r >= 1; r--) for (let f = 0; f < 8; f++) squares.push({ name: `${FILES[f]}${r}`, dark: (f + r) % 2 === 0 });

  const bottomRank = orientation === 'w' ? 1 : 8;
  const leftFile = orientation === 'w' ? 'a' : 'h';

  return (
    <svg
      className={`board${interactive ? ' board-live' : ''}`}
      viewBox={`0 0 ${8 * S} ${8 * S}`}
      role="grid"
      aria-label="Chess board"
    >
      {squares.map(({ name, dark }) => {
        const { x, y } = pos(name);
        const cls = ['sq', dark ? 'sq-dark' : 'sq-light'];
        if (selected === name) cls.push('sq-selected');
        else if (lastMove && (lastMove.from === name || lastMove.to === name)) cls.push('sq-last');
        if (check === name) cls.push('sq-check');
        const p = pieceAt.get(name);
        const label = p ? `${name}, ${p.color === 'w' ? 'white' : 'black'} ${PIECE_NAME[p.type]}` : name;
        // Squares are buttons with NO child text: a square group that also holds a
        // coordinate <text> is dropped from the a11y tree in favour of the text.
        return (
          <g key={name} className={cls.join(' ')} onClick={() => onTap(name)} role="button" aria-label={label}>
            <rect x={x} y={y} width={S} height={S} />
            {check === name && <rect x={x} y={y} width={S} height={S} className="sq-check-wash" />}
          </g>
        );
      })}
      {squares
        .filter(({ name }) => name[1] === String(bottomRank) || name[0] === leftFile)
        .map(({ name, dark }) => {
          const { x, y } = pos(name);
          const cls = `coord${dark ? ' coord-dark' : ''}`;
          return (
            <g key={`coord-${name}`} aria-hidden>
              {name[1] === String(bottomRank) && (
                <text className={cls} x={x + S - 8} y={y + S - 7} textAnchor="end">
                  {name[0]}
                </text>
              )}
              {name[0] === leftFile && (
                <text className={cls} x={x + 7} y={y + 22}>
                  {name[1]}
                </text>
              )}
            </g>
          );
        })}
      {pieces.map((p) => {
        const { x, y } = pos(p.square);
        return <Piece key={p.square} type={p.type} color={p.color} x={x} y={y} size={S} />;
      })}
      {targets.map((t) => {
        const { x, y } = pos(t.to);
        return t.capture ? (
          <circle key={t.to} className="dot dot-capture" cx={x + S / 2} cy={y + S / 2} r={S * 0.42} pointerEvents="none" />
        ) : (
          <circle key={t.to} className="dot" cx={x + S / 2} cy={y + S / 2} r={S * 0.16} pointerEvents="none" />
        );
      })}
      {/* transparent hit layer so taps land even over pieces/dots */}
      {squares.map(({ name }) => {
        const { x, y } = pos(name);
        return (
          <rect
            key={`hit-${name}`}
            className={`hit${targetMap.has(name) ? ' hit-target' : ''}`}
            data-sq={name}
            x={x}
            y={y}
            width={S}
            height={S}
            fill="transparent"
            onClick={() => onTap(name)}
          />
        );
      })}
    </svg>
  );
}

export default Board;
