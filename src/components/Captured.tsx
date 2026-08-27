import type { Captured as CapturedT, PieceType } from '../lib/rules';
import type { Color } from '../lib/types';

const GLYPH: Record<PieceType, string> = {
  k: '♚︎',
  q: '♛︎',
  r: '♜︎',
  b: '♝︎',
  n: '♞︎',
  p: '♟︎',
};

interface Props {
  captured: CapturedT;
  /** Whose captures to show (the pieces this color has taken). */
  by: Color;
}

/** The pieces one side has captured, plus the material edge if any. */
function Captured({ captured, by }: Props) {
  const list = by === 'w' ? captured.byWhite : captured.byBlack;
  const edge = by === 'w' ? captured.balance : -captured.balance;
  const victim = by === 'w' ? 'b' : 'w';
  return (
    <span className="captured" aria-label={`Captured by ${by === 'w' ? 'White' : 'Black'}`}>
      {list.map((p, i) => (
        <span key={i} className={`cap piece-${victim}`}>
          {GLYPH[p]}
        </span>
      ))}
      {edge > 0 && <span className="cap-edge">+{edge}</span>}
    </span>
  );
}

export default Captured;
