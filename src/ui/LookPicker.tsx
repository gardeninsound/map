import { useMemo } from 'react';
import { buildRabbit } from '../city';
import { dress, FURS, HATS, LOOK_SCARVES, type Look } from '../game/look';
import { sounds } from './sounds';

/**
 * The LOOK panel (idea box #38, #34): your rabbit's fur, scarf and hat. Each hat shows on a
 * little copy of your rabbit; the choice is remembered and everyone online sees it.
 */
export function LookPicker({ look, onChange, onClose }: { look: Look; onChange(l: Look): void; onClose(): void }) {
  // a picture of your rabbit in each hat, in your fur and scarf
  const previews = useMemo(
    () => HATS.map((_, hat) => dress(buildRabbit(LOOK_SCARVES[look.scarf]), { ...look, hat }).down[0]!.toDataURL()),
    [look.fur, look.scarf], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pick = (l: Look) => {
    sounds.pop();
    onChange(l);
  };
  return (
    <div className="look-picker" role="group" aria-label="How your rabbit looks">
      <div className="look-row">
        <span className="look-label">FUR</span>
        {FURS.map((f, i) => (
          <button key={f.name} className="look-swatch" style={{ background: f.main }} aria-label={`${f.name} fur`} aria-pressed={look.fur === i} onClick={() => pick({ ...look, fur: i })} />
        ))}
      </div>
      <div className="look-row">
        <span className="look-label">SCARF</span>
        {LOOK_SCARVES.map((c, i) => (
          <button key={c} className="look-swatch" style={{ background: c }} aria-label={`Scarf ${i + 1}`} aria-pressed={look.scarf === i} onClick={() => pick({ ...look, scarf: i })} />
        ))}
      </div>
      <div className="look-row look-hats">
        {HATS.map((h, i) => (
          <button key={h.name} className="look-hat" aria-label={h.name} title={h.name} aria-pressed={look.hat === i} onClick={() => pick({ ...look, hat: i })}>
            <img src={previews[i]} alt="" />
          </button>
        ))}
      </div>
      <button className="look-done" onClick={onClose}>
        DONE
      </button>
    </div>
  );
}
