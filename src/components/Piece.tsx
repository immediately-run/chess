import type { PieceType } from '../lib/rules';

// Filled Unicode chess glyphs for BOTH colors (the "white" outline glyphs look
// thin on screens); color comes from the CSS piece tokens. The variation
// selector pins text presentation so ♟ never renders as an emoji.
const GLYPH: Record<PieceType, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
};

interface Props {
  type: PieceType;
  color: 'w' | 'b';
  /** Top-left corner and side of the square, in SVG user units. */
  x: number;
  y: number;
  size: number;
}

/** One piece, rendered as SVG text inside a board square. */
function Piece({ type, color, x, y, size }: Props) {
  return (
    <text
      className={`piece piece-${color}`}
      x={x + size / 2}
      y={y + size / 2}
      fontSize={size * 0.8}
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
    >
      {GLYPH[type]}
    </text>
  );
}

export default Piece;
