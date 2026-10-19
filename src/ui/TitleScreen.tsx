import { useEffect } from 'react';
import { input } from 'west-seattle-map';
import { sounds as sfx } from './sounds';

export function TitleScreen({ onStart }: { onStart(): void }) {
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'a' || b === 'start') {
          input.consume(b);
          sfx.confirm();
          onStart();
        }
      }),
    [onStart],
  );

  return (
    <div className="title">
      <div className="title-sky" aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 60}%`, animationDelay: `${(i % 7) * 0.4}s` }} />
        ))}
      </div>
      <div className="title-card">
        <p className="title-kicker">West Seattle · 2016–2026</p>
        <h1 className="title-logo">
          BEAR
          <br />
          ISLAND
        </h1>
        <p className="title-sub">Ten years of public propaganda, one block at a time.</p>
        <button className="title-start" autoFocus onClick={() => { sfx.confirm(); onStart(); }}>
          <span className="title-caret">▶</span> PRESS START
        </button>
        <p className="title-keys">
          Arrows / WASD walk · Shift runs · Space looks · M map · T art spots
        </p>
      </div>
    </div>
  );
}
