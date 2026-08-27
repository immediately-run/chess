import type { Color } from '../lib/types';

const GLYPH: Record<string, string> = { q: '♛︎', r: '♜︎', b: '♝︎', n: '♞︎' };
const NAME: Record<string, string> = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };

interface Props {
  color: Color;
  onPick: (p: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

/** Choose the piece a pawn becomes. */
function PromotionPicker({ color, onPick, onCancel }: Props) {
  return (
    <div className="promo" role="dialog" aria-label="Promote pawn">
      <p className="promo-title">Promote to</p>
      <div className="promo-row">
        {(['q', 'r', 'b', 'n'] as const).map((p) => (
          <button key={p} type="button" className={`promo-btn piece-${color}`} onClick={() => onPick(p)} aria-label={NAME[p]}>
            <span className="promo-glyph" aria-hidden>
              {GLYPH[p]}
            </span>
            <span className="promo-name">{NAME[p]}</span>
          </button>
        ))}
      </div>
      <button type="button" className="linkbtn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export default PromotionPicker;
