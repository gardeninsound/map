/**
 * What every three.js scene shares (the Duck Arcade, Duck on the Moon, the cup, the park, Luna
 * Park's rides): a renderer drawn at 1/`pixel` size and scaled up for the pixel look (or smooth,
 * for Duck on the Moon), fitted to its host on resize, a frame loop with a capped `dt`, drag
 * tracking, and a dispose that frees every geometry, material and texture and every listener.
 *
 *   class MyScene extends PixelScene {
 *     constructor(host: HTMLElement) {
 *       super(host, new THREE.PerspectiveCamera(60, 1, 0.1, 100));
 *       // …build this.scene…
 *       this.start();                       // last: sizes the canvas and starts the loop
 *     }
 *     protected frame(dt: number, time: number) { … }  // move things; the base renders after
 *   }
 */
import * as THREE from 'three';

export type PixelSceneOptions = {
  /** screen pixels per rendered pixel (3: the chunky look); ignored when `smooth` */
  pixel?: number;
  /** full resolution and antialiased (Duck on the Moon's soft look) */
  smooth?: boolean;
  /** the canvas's CSS class */
  className?: string;
};

/** frees a scene's geometries, materials and their textures */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.geometry && !m.material) return;
    m.geometry?.dispose();
    for (const mat of [m.material].flat() as THREE.Material[]) {
      if (!mat) continue;
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

export abstract class PixelScene {
  readonly renderer: THREE.WebGLRenderer;
  protected readonly scene = new THREE.Scene();
  protected disposed = false;
  private raf = 0;
  private last = 0;
  private readonly pixel: number;
  private readonly smooth: boolean;
  private readonly unlisten: (() => void)[] = [];

  constructor(
    protected readonly host: HTMLElement,
    protected readonly camera: THREE.PerspectiveCamera,
    { pixel = 3, smooth = false, className = 'park-canvas' }: PixelSceneOptions = {},
  ) {
    this.pixel = pixel;
    this.smooth = smooth;
    this.renderer = new THREE.WebGLRenderer({ antialias: smooth });
    this.renderer.setPixelRatio(smooth ? Math.min(devicePixelRatio, 2) : 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = className;
    host.appendChild(this.renderer.domElement);
  }

  /** the scene's canvas */
  protected get canvas() {
    return this.renderer.domElement;
  }

  /** listens until dispose */
  protected listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void): void;
  protected listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void): void;
  protected listen(target: EventTarget, type: string, fn: (e: never) => void) {
    const f = fn as EventListener;
    target.addEventListener(type, f);
    this.unlisten.push(() => target.removeEventListener(type, f));
  }

  /**
   * A drag on the canvas (followed over the whole window): `onDrag(dx, dy)` as it moves, `onEnd(moved)`
   * when let go (`moved`: px from where it started; a click is a few). `capture` keeps the pointer on the
   * canvas. Returns whether a drag is going on.
   */
  protected drag({ onDrag, onEnd, capture = false }: { onDrag(dx: number, dy: number): void; onEnd?(moved: number, e: PointerEvent): void; capture?: boolean }) {
    let at: { x: number; y: number } | null = null;
    let from = { x: 0, y: 0 };
    this.listen(this.canvas, 'pointerdown', (e) => {
      at = from = { x: e.clientX, y: e.clientY };
      if (capture) this.canvas.setPointerCapture(e.pointerId);
    });
    this.listen(window, 'pointermove', (e) => {
      if (!at) return;
      onDrag(e.clientX - at.x, e.clientY - at.y);
      at = { x: e.clientX, y: e.clientY };
    });
    this.listen(window, 'pointerup', (e) => {
      if (!at) return;
      at = null;
      onEnd?.(Math.hypot(e.clientX - from.x, e.clientY - from.y), e);
    });
    return {
      get active() {
        return at !== null;
      },
    };
  }

  /** call last in the subclass's constructor: fits the canvas and starts the loop */
  protected start() {
    this.listen(window, 'resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** one frame: move things (`dt` in s, capped at 0.05; `time` in ms); the base renders after */
  protected abstract frame(dt: number, time: number): void;

  /** extra cleanup before the scene is freed (controls, a video…) */
  protected teardown(): void {}

  private loop = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (time - (this.last || time)) / 1000);
    this.last = time;
    this.frame(dt, time);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (this.smooth) this.renderer.setSize(w, h, false);
    else this.renderer.setSize(Math.ceil(w / this.pixel), Math.ceil(h / this.pixel), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const off of this.unlisten.splice(0)) off();
    this.teardown();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * Looking round from a ride (the Figure Eight, the Giant Whirl): drag to glance away from where
 * the ride points you, within limits; let go and your gaze drifts back.
 */
export class Glance {
  yaw = 0;
  pitch = 0;
  turn(dx: number, dy: number) {
    this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.006, -2.4, 2.4);
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -0.9, 0.7);
  }
  /** drift back toward straight ahead (call each frame you're not dragging) */
  settle(dt: number) {
    const k = 1 - Math.min(1, dt * 1.5);
    this.yaw *= k;
    this.pitch *= k;
  }
  /** turn the camera by the glance, after the ride has aimed it */
  apply(camera: THREE.Camera) {
    camera.rotateY(this.yaw);
    camera.rotateX(this.pitch);
  }
}
