import { useEffect } from 'react';
import { artManifest } from '../content/artManifest';
import type { PlacedLocation } from '../game/Game';
import { input, isTouch } from '../game/input';
import { sfx } from './sfx';

interface Props {
  spots: PlacedLocation[];
  visited: Set<string>;
  /** jump there and open its scene */
  onOpen(loc: PlacedLocation): void;
  /** just drop me beside the lemon */
  onGo(loc: PlacedLocation): void;
  onClose(): void;
}

const thumb = (loc: PlacedLocation) => {
  const first = artManifest[loc.set]?.find((a) => a.kind === 'image');
  return first ? `${import.meta.env.BASE_URL}art/${loc.set}/${first.id}-t.webp` : null;
};

/**
 * Shortcut menu: every art spot that has a scene, one tap from wherever you are.
 * Number keys 1–9 open the matching card; B / Esc closes.
 */
export function SpotsMenu({ spots, visited, onOpen, onGo, onClose }: Props) {
  useEffect(() => {
    const off = input.on((b) => {
      if (b === 'b' || b === 'spots') {
        input.consume(b);
        sfx.back();
        onClose();
      }
    });
    const key = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= spots.length) {
        e.preventDefault();
        sfx.confirm();
        onOpen(spots[n - 1]);
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      off();
      window.removeEventListener('keydown', key);
    };
  }, [spots, onOpen, onClose]);

  return (
    <div className="spots-layer" onClick={onClose}>
      <div className="spots" role="dialog" aria-label="Art spots" onClick={(e) => e.stopPropagation()}>
        <div className="spots-head">
          <h2>ART SPOTS</h2>
          <button className="spots-close" onClick={() => { sfx.back(); onClose(); }} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className="spots-list">
          {spots.map((loc, i) => {
            const src = thumb(loc);
            return (
              <li key={loc.id} className="spot">
                <div className="spot-thumb" style={{ background: `linear-gradient(135deg, ${loc.colors.p}, ${loc.colors.t})` }}>
                  {src && (
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  )}
                  {!isTouch() && <kbd className="spot-key">{i + 1}</kbd>}
                </div>
                <div className="spot-info">
                  <div className="spot-name">
                    {loc.name}
                    {visited.has(loc.id) && <span className="spot-seen" title="Visited">✓</span>}
                  </div>
                  <div className="spot-where">{loc.where}</div>
                  <div className="spot-actions">
                    <button
                      className="primary"
                      autoFocus={i === 0}
                      onClick={() => { sfx.confirm(); onOpen(loc); }}
                    >
                      ▶ OPEN
                    </button>
                    <button onClick={() => { sfx.confirm(); onGo(loc); }}>GO THERE</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="spots-foot">More spots open as Mike finishes them — the green lemons on the map are coming soon.</p>
      </div>
    </div>
  );
}
