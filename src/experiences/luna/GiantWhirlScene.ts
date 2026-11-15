import * as THREE from 'three';
import { ARM, HUB, MAST, RIDE, seatAt, spinAt, swingOut } from './whirl';

/** Render at 1/PIXEL resolution and scale up crisp, like the Figure Eight. */
const PIXEL = 3;
const DECK = 4;
const ARMS = 12;
/** which car you're in */
const YOURS = 0;

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export interface WhirlEvents {
  /** stopped, everyone hanging straight again */
  onFinished(): void;
}

/**
 * Riding the Giant Whirl (idea box #41): a circle swing on Luna Park's pier at dusk, 1907.
 * The tower — a white mast striped red, a crown of bulbs, twelve cars on long arms — spins
 * up and flings you out over the boardwalk and the bay; drag to look round. Reduced motion
 * watches from the boardwalk. Motion is pure + tested in whirl.ts.
 */
export class GiantWhirlScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, 0.1, 6000);
  private top = new THREE.Group();
  private cars: { arm: THREE.Group; car: THREE.Group }[] = [];
  private t = 0;
  private turn = 0;
  private done = false;
  private look = { yaw: 0, pitch: 0 };
  private dragging: { x: number; y: number } | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private events: WhirlEvents,
    private watch: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.className = 'park-canvas';
    host.appendChild(el);
    this.buildWorld();
    this.buildWhirl();
    if (watch) {
      this.camera.position.set(-26, DECK + 1.7, 22);
      this.camera.lookAt(0, DECK + 9, 0);
    }
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  restart() {
    this.t = 0;
    this.done = false;
  }

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color('#c97a8a');
    s.fog = new THREE.Fog('#d9a58a', 200, 2400);
    // a dusk sky: gold low in the west, deep blue overhead
    const sky = new THREE.SphereGeometry(3000, 24, 12);
    const pos = sky.attributes.position;
    const cols: number[] = [];
    const low = new THREE.Color('#f3b26b'), mid = new THREE.Color('#c97a8a'), high = new THREE.Color('#2a2f63'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 3000;
      if (y < 0.12) c.copy(low).lerp(mid, Math.max(0, y) / 0.12);
      else c.copy(mid).lerp(high, Math.min(1, (y - 0.12) / 0.5));
      cols.push(c.r, c.g, c.b);
    }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    s.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    s.add(new THREE.HemisphereLight('#ffd6b0', '#2a3a55', 1.3));
    const sun = new THREE.DirectionalLight('#ffc28a', 1.3);
    sun.position.set(-300, 120, 80);
    s.add(sun);
    // Elliott Bay
    const water = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), lambert('#3f6f7a'));
    water.rotation.x = -Math.PI / 2;
    s.add(water);
    // the pier: a plank deck on pilings
    const deck = new THREE.Mesh(new THREE.BoxGeometry(70, 0.6, 50), lambert('#8a6a44'));
    deck.position.y = DECK - 0.3;
    s.add(deck);
    for (let x = -34; x <= 34; x += 6) for (let z = -24; z <= 24; z += 6) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, DECK, 5), lambert('#4a3a2a'));
      pile.position.set(x, DECK / 2 - 0.3, z);
      s.add(pile);
    }
    // the boardwalk's railing and lamp posts, strung with bulbs
    const bulb = new THREE.MeshBasicMaterial({ color: '#ffe8a8' });
    for (let x = -34; x <= 34; x += 4) {
      for (const z of [-25, 25]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), lambert('#f3efe4'));
        post.position.set(x, DECK + 0.6, z);
        s.add(post);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), bulb);
        b.position.set(x, DECK + 1.3, z);
        s.add(b);
      }
    }
    // the rest of the park, as shapes against the sky: the Figure Eight's trestle, the carousel's roof, the natatorium
    const shape = (w: number, h: number, d: number, x: number, z: number, color: string) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
      m.position.set(x, DECK + h / 2, z);
      s.add(m);
    };
    shape(30, 18, 6, 10, -40, '#efe6d2');
    shape(16, 7, 12, -30, -30, '#d8c7a0');
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 5, 12), lambert('#4f8a5a'));
    roof.position.set(28, DECK + 8, 10);
    s.add(roof);
    shape(10, 5, 10, 28, 10, '#f3efe4');
    // across the water: the city's hills, and the Olympics in the west
    const ridge = (x: number, z: number, w: number, h: number, color: string) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), lambert(color, { fog: false }));
      m.position.set(x, h / 2 - 2, z);
      s.add(m);
    };
    for (let i = 0; i < 9; i++) ridge(-1800, -900 + i * 230, 180 + (i % 3) * 60, 160 + (i % 4) * 70, '#4a4a6a');
    for (let i = 0; i < 6; i++) ridge(300 + i * 160, -1500, 160, 70 + (i % 3) * 30, '#3a3a52');
    // the young city's lights across the bay
    const lights = new THREE.MeshBasicMaterial({ color: '#ffd27a', fog: false });
    for (let i = 0; i < 60; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), lights);
      l.position.set(200 + ((i * 97) % 900), 4 + ((i * 31) % 40), -1300 - ((i * 53) % 200));
      s.add(l);
    }
  }

  private buildWhirl() {
    const s = this.scene;
    const white = lambert('#f3efe4'), red = lambert('#d63a3a'), gold = lambert('#e8c25a'), ink = lambert('#2a1a12');
    const bulb = new THREE.MeshBasicMaterial({ color: '#fff1c0' });
    // the mast: white, wound with a red stripe
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, MAST - DECK + 1, 10), white);
    mast.position.y = DECK + (MAST - DECK + 1) / 2;
    s.add(mast);
    for (let y = DECK + 1; y < MAST; y += 1.6) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 10), red);
      band.position.y = y;
      s.add(band);
    }
    // the base: a ticket booth ring round the foot
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.2, 12), lambert('#4f8a5a'));
    base.position.y = DECK + 0.6;
    s.add(base);
    // the turning top: a striped canopy and its crown of bulbs
    this.top.position.y = MAST;
    s.add(this.top);
    for (let i = 0; i < 12; i++) {
      const slice = new THREE.Mesh(new THREE.ConeGeometry(HUB + 0.6, 2.4, 3, 1, true, (i / 12) * Math.PI * 2, Math.PI / 6), i % 2 ? red : white);
      slice.position.y = 1.4;
      this.top.add(slice);
    }
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), gold);
    finial.position.y = 2.9;
    this.top.add(finial);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), bulb);
      b.position.set(Math.cos(a) * (HUB + 0.6), 0.2, Math.sin(a) * (HUB + 0.6));
      this.top.add(b);
    }
    // the arms: chains from the hub's rim, a little car on each
    const chain = lambert('#5a5a62');
    const carColors = ['#2f6fd8', '#ffb627', '#ff2e93', '#2ec4b6'];
    for (let k = 0; k < ARMS; k++) {
      const arm = new THREE.Group();
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ARM, 4), chain);
      rope.position.y = -ARM / 2;
      arm.add(rope);
      const car = new THREE.Group();
      car.position.y = -ARM;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.9), lambert(carColors[k % carColors.length]!));
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1, 0.9), lambert(carColors[k % carColors.length]!));
      back.position.set(-0.5, 0.5, 0);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), ink);
      bar.position.set(0.5, 0.6, 0);
      car.add(seat, back, bar);
      arm.add(car);
      s.add(arm);
      this.cars.push({ arm, car });
    }
  }

  private pose() {
    const w = spinAt(this.t);
    const th = swingOut(w);
    this.top.rotation.y = -this.turn;
    this.cars.forEach(({ arm }, k) => {
      const a = this.turn + (k / ARMS) * Math.PI * 2;
      arm.position.set(Math.cos(a) * HUB, MAST, Math.sin(a) * HUB);
      // face outward, then swing out
      arm.rotation.set(0, -a, 0);
      arm.rotateZ(th);
    });
    if (this.watch) {
      this.camera.lookAt(0, MAST - 3, 0);
      return;
    }
    // your seat: looking along the way you're going, leaning out with the swing
    const seat = seatAt(YOURS, ARMS, this.turn, th);
    this.camera.position.set(seat.x, seat.y + 0.9, seat.z);
    const a = seat.heading;
    const ahead = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const target = this.camera.position.clone().add(ahead.multiplyScalar(10)).add(out.multiplyScalar(4)).add(new THREE.Vector3(0, -0.6, 0));
    this.camera.lookAt(target);
    this.camera.rotateZ(-th * 0.22);
    this.camera.rotateY(this.look.yaw);
    this.camera.rotateX(this.look.pitch);
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (time - (this.last || time)) / 1000);
    this.last = time;
    this.t += dt;
    this.turn += spinAt(this.t) * dt;
    if (!this.done && this.t >= RIDE + 0.5) {
      this.done = true;
      this.events.onFinished();
    }
    this.pose();
    if (!this.dragging) {
      this.look.yaw *= 1 - Math.min(1, dt * 1.5);
      this.look.pitch *= 1 - Math.min(1, dt * 1.5);
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  private onDown = (e: PointerEvent) => {
    this.dragging = { x: e.clientX, y: e.clientY };
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.look.yaw = THREE.MathUtils.clamp(this.look.yaw - (e.clientX - this.dragging.x) * 0.006, -2.4, 2.4);
    this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - (e.clientY - this.dragging.y) * 0.004, -0.9, 0.7);
    this.dragging = { x: e.clientX, y: e.clientY };
  };
  private onUp = () => {
    this.dragging = null;
  };

  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(Math.ceil(w / PIXEL), Math.ceil(h / PIXEL), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('resize', this.resize);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
