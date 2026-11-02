import { useCallback, useEffect, useRef, useState } from 'react';
import { artUrl, videoUrl } from '../content/art';
import { artManifest } from '../content/artManifest';
import { videoScripts } from '../content/videos';
import { buttonLabel, input } from '../city';
import { DialogBox } from '../ui/MikeDialog';
import { sounds as sfx } from '../ui/sounds';
import type { ExperienceProps } from './registry';

/** One video, framed like the walls: {A} plays / pauses, {B} leaves. Sound follows the mute toggle. */
export default function VideoScene({ location, onExit }: ExperienceProps) {
  const asset = artManifest[location.set]?.find((a) => a.kind === 'video');
  const script = videoScripts[location.id];
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [outro, setOutro] = useState(false);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const replay = useCallback(() => {
    setOutro(false);
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {});
  }, []);

  const handlers = useRef({ toggle, onExit, outro });
  handlers.current = { toggle, onExit, outro };

  useEffect(() => {
    const off = input.on((b) => {
      const h = handlers.current;
      if (b === 'b') {
        input.consume('b');
        sfx.back();
        h.onExit();
      } else if (b === 'a' && !h.outro) {
        input.consume('a');
        h.toggle();
      }
    });
    return off;
  }, []);

  if (!asset) return null;

  return (
    <div className="scene wall-scene">
      <header className="scene-bar">
        <div>
          <h2 className="scene-title">{script?.title ?? location.name}</h2>
          <p className="scene-where">{location.where}</p>
        </div>
      </header>

      <div className="wall-stage">
        <div className="wall-frame" style={{ background: asset.color }}>
          <video
            ref={video}
            className="wall-media"
            src={videoUrl(location.set, asset.id)}
            poster={artUrl(location.set, asset.id)}
            autoPlay
            playsInline
            muted={sfx.isMuted()}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setOutro(true)}
            onClick={toggle}
            aria-label={location.name}
          />
        </div>
      </div>

      <div className="scene-controls">
        <button className="primary" onClick={toggle}>
          {playing ? '❚❚ PAUSE' : '▶ PLAY'} <kbd>{buttonLabel('a')}</kbd>
        </button>
        <button onClick={replay}>↺ AGAIN</button>
        <button onClick={() => { sfx.back(); onExit(); }}>LEAVE <kbd>{buttonLabel('b')}</kbd></button>
      </div>

      {outro && script && (
        <div className="scene-dialog">
          <DialogBox
            lines={script.outro}
            onDone={() => setOutro(false)}
            choices={[
              { label: 'Watch again', onPick: replay },
              { label: 'Back to the streets', onPick: onExit },
            ]}
          />
        </div>
      )}
    </div>
  );
}
