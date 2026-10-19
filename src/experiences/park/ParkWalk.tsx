import { useEffect, useRef, useState } from 'react';
import { artUrl } from '../../content/art';
import { artManifest } from '../../content/artManifest';
import { parkScript, parkSigns } from '../../content/puppyPark';
import { buttonLabel, input, isTouch } from '../../city';
import { DialogBox } from '../../ui/MikeDialog';
import { TouchPad } from '../../city';
import { sounds as sfx } from '../../ui/sounds';
import type { ExperienceProps } from '../registry';
import { ParkScene } from './ParkScene';

const monthYear = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

/**
 * Seven+ Stories: walk the lot in first person. The signs stand in the field where they
 * stood; get close and face one to read it up close.
 */
export default function ParkWalk({ location, onExit }: ExperienceProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ParkScene | null>(null);
  const [near, setNear] = useState<number | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const [intro, setIntro] = useState(true);
  const assets = Object.fromEntries((artManifest[location.set] ?? []).map((a) => [a.id, a]));
  const art = (id: string) => artUrl(location.set, id);

  useEffect(() => {
    const s = new ParkScene(host.current!, { onNear: setNear }, parkSigns, assets, art);
    scene.current = s;
    let raf = 0;
    const poll = () => {
      const d = input.dir();
      s.setMove(-d.y, d.x, input.running());
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
      s.dispose();
    };
    // the scene is built once; signs and art urls don't change while it's open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stand still while a dialog or close-up is open.
  useEffect(() => {
    if (scene.current) scene.current.paused = intro || reading !== null;
  }, [intro, reading]);

  const state = useRef({ near, reading, intro, onExit });
  state.current = { near, reading, intro, onExit };
  useEffect(
    () =>
      input.on((b) => {
        const st = state.current;
        if (st.intro && b !== 'b') return; // the dialog handles its own A; B always leaves
        if (b === 'a') {
          input.consume('a');
          if (st.reading !== null) setReading(null);
          else if (st.near !== null) {
            sfx.confirm();
            setReading(st.near);
          }
        } else if (b === 'b') {
          input.consume('b');
          sfx.back();
          if (st.reading !== null) setReading(null);
          else st.onExit();
        }
      }),
    [],
  );

  const sign = reading !== null ? parkSigns[reading] : null;
  const nearSign = near !== null ? parkSigns[near] : null;

  return (
    <div className="scene park-scene">
      <div ref={host} className="park-stage" aria-label="A first-person view of the lot at 4731 40th Ave SW, with signs standing in the field." />

      <header className="scene-bar park-bar">
        <div>
          <h2 className="scene-title">{parkScript.title}</h2>
          <p className="scene-where">{location.where}</p>
        </div>
        <button className="park-leave" onClick={() => { sfx.back(); onExit(); }}>
          LEAVE <kbd>{buttonLabel('b')}</kbd>
        </button>
      </header>

      {nearSign && reading === null && !intro && (
        <div className="nearby park-prompt">
          <div className="nearby-name">{nearSign.title}</div>
          <div className="nearby-hint">
            <kbd>{buttonLabel('a')}</kbd> read
          </div>
        </div>
      )}

      {!intro && reading === null && !isTouch() && (
        <p className="cup-hint">arrows / WASD walk &amp; turn · drag to look · shift runs</p>
      )}

      {sign && (
        <div className="park-read" onClick={() => setReading(null)}>
          <figure className="park-photo" onClick={(e) => e.stopPropagation()}>
            <img src={art(sign.asset)} alt={sign.title} style={{ background: assets[sign.asset]?.color }} />
            <figcaption>
              <span className="park-photo-title">{sign.title}</span>
              {assets[sign.asset] && <span className="park-photo-date">{monthYear(assets[sign.asset].date)}</span>}
            </figcaption>
          </figure>
          <div className="quip park-quip" role="status">
            <img src={`${import.meta.env.BASE_URL}sprites/mike-portrait.png`} alt="" />
            <p>{sign.says}</p>
          </div>
          <button className="park-close" onClick={() => setReading(null)}>
            BACK TO THE FIELD <kbd>{buttonLabel('b')}</kbd>
          </button>
        </div>
      )}

      {isTouch() && !intro && reading === null && <TouchPad showB />}

      {intro && (
        <div className="scene-dialog">
          <DialogBox lines={parkScript.intro} onDone={() => setIntro(false)} />
        </div>
      )}
    </div>
  );
}
