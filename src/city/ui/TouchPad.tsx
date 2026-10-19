import { useRef } from 'react';
import { input, type Dir } from '../engine/input';

/**
 * On-screen D-pad + A/B for touch screens. The pad reads the finger's angle from
 * its centre so you can roll your thumb between directions (and diagonals).
 */
export function TouchPad({ showB = false }: { showB?: boolean }) {
  const pad = useRef<HTMLDivElement>(null);

  const setFromPoint = (clientX: number, clientY: number) => {
    const r = pad.current!.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const dead = r.width * 0.12;
    const dirs: [Dir, boolean][] = [
      ['left', dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.4],
      ['right', dx > dead && Math.abs(dx) > Math.abs(dy) * 0.4],
      ['up', dy < -dead && Math.abs(dy) > Math.abs(dx) * 0.4],
      ['down', dy > dead && Math.abs(dy) > Math.abs(dx) * 0.4],
    ];
    dirs.forEach(([d, on]) => input.hold(d, on));
  };
  const release = () => (['up', 'down', 'left', 'right'] as Dir[]).forEach((d) => input.hold(d, false));

  return (
    <div className="touchpad" aria-hidden>
      <div
        ref={pad}
        className="dpad"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPoint(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons && setFromPoint(e.clientX, e.clientY)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="dpad-cross" />
      </div>
      <div className="ab">
        {showB && (
          <button className="btn-b" onPointerDown={(e) => { e.preventDefault(); input.press('b'); }}>B</button>
        )}
        <button className="btn-a" onPointerDown={(e) => { e.preventDefault(); input.press('a'); }}>A</button>
      </div>
    </div>
  );
}
