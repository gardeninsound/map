import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MoonSound } from '../../content/duckOnTheMoon';

export interface DuckMoonEvents {
  /** Pip sets off toward a sound */
  depart(kind: MoonSound): void;
  /** Pip reached a sound's pedestal: play it, tell its story */
  arrive(kind: MoonSound): void;
  /** the pointer is over a sound (or not) */
  hover(over: boolean): void;
  /** arrows held (-1..1 each): orbit the camera */
  dir(): { x: number; y: number };
}

const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });

/** Where the three sounds sit on the moon, and their orb colour. */
const SOUNDS: [MoonSound, number, number, string][] = [
  ['wolves', 3.5, -2, '#e5a992'],
  ['rain', -0.4, -4.3, '#aac5bd'],
  ['storm', 3.8, 3.2, '#dfc77e'],
];

/**
 * Duck on the Moon: a paper-cut moon with an observatory, Pip the duck and three glowing
 * sounds. Click one (or `walkTo`) and Pip waddles over; on arrival the sound's prop appears
 * (umbrella, wolves in space suits, a plasma dome) and `arrive` fires. Drag orbits, wheel
 * zooms, arrows orbit too.
 */
export class DuckMoonScene {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private controls: OrbitControls;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private down: [number, number] | null = null;
  private targets: THREE.Group[] = [];
  private duck = new THREE.Group();
  private feet: THREE.Mesh[] = [];
  private umbrella = new THREE.Group();
  private wolves = new THREE.Group();
  private wolfModels: THREE.Group[] = [];
  private wolvesStart = 0;
  private storm = new THREE.Group();
  private plasma: THREE.Line[] = [];
  private electrode!: THREE.Mesh;
  private walk: { from: THREE.Vector3; end: THREE.Vector3; start: number; duration: number; kind: MoonSound } | null = null;
  private raf = 0;
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private events: DuckMoonEvents,
    private reduced: boolean,
  ) {
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(r.domElement);
    r.domElement.className = 'duck-moon-canvas';

    const s = this.scene;
    s.background = new THREE.Color('#25243b');
    s.fog = new THREE.Fog('#25243b', 24, 48);
    s.add(new THREE.HemisphereLight(0xf8dfb8, 0x555071, 2));
    const light = new THREE.DirectionalLight(0xffdfb6, 2);
    light.position.set(-6, 12, 8);
    s.add(light);
    this.build();

    this.camera.position.set(10, 9, 13);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.enableDamping = !reduced;

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointermove', this.onMove);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  private add<T extends THREE.Object3D>(o: T, parent: THREE.Object3D = this.scene) {
    parent.add(o);
    return o;
  }

  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, parent?: THREE.Object3D) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    return this.add(o, parent);
  }

  private build() {
    const m = this.mesh.bind(this);
    const dark = mat('#3a3943');
    const cream = mat('#ebd9ac');
    const yellow = mat('#e8c77a');
    const orange = mat('#c98855');
    const blue = mat('#728b8c');

    // A layered, paper-cut moon
    m(new THREE.CylinderGeometry(6.2, 5.9, 0.65, 48), mat('#c3b89c'), 0, -0.3, 0);
    m(new THREE.CylinderGeometry(6.08, 6.08, 0.08, 48), mat('#dfd3b1'), 0, 0.04, 0);
    for (let i = 0; i < 30; i++) {
      const a = i * 2.4;
      const r = 1.3 + ((i * 1.31) % 4.6);
      m(new THREE.CircleGeometry(0.08 + (i % 4) * 0.035, 7), mat(i % 2 ? '#c9bda0' : '#e9dbb9'), Math.cos(a) * r, 0.095, Math.sin(a) * r, -Math.PI / 2);
    }

    // Observatory made of simple cut-paper shapes
    const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, ry = 0) =>
      m(new THREE.BoxGeometry(w, h, d), mat(c), x, y, z, 0, ry);
    box(2.6, 2.2, 2.3, '#bba58e', -2.25, 1.17, -1.3, 0.12);
    m(new THREE.ConeGeometry(2.05, 1.15, 8), mat('#a17970'), -2.25, 2.84, -1.3, 0, 0.12);
    box(0.75, 1.4, 0.08, '#3a3943', -2.1, 0.75, -0.12);
    box(0.5, 0.58, 0.09, '#e6c884', -3.05, 1.65, -0.12);
    box(1.5, 0.18, 0.3, '#705d55', -2.25, 2.25, -0.05);

    // Telescope
    m(new THREE.CylinderGeometry(0.08, 0.12, 1.65, 7), dark, -1, 1.2, -0.3, 0, 0, -0.2);
    m(new THREE.CylinderGeometry(0.25, 0.34, 1.8, 10), blue, -0.95, 2.15, -0.3, 0, 0, -1.03);
    m(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 10), orange, -0.2, 2.6, -0.3, 0, 0, -1.03);

    // Pip: deliberately simple felt-like volumes
    const duck = this.add(this.duck);
    duck.position.set(1.35, 0.1, 1.1);
    const part = (g: THREE.BufferGeometry, mt: THREE.Material, x: number, y: number, z: number) => m(g, mt, x, y, z, 0, 0, 0, duck);
    part(new THREE.SphereGeometry(0.65, 14, 10), cream, 0, 0.66, 0).scale.set(1, 0.85, 0.8);
    part(new THREE.SphereGeometry(0.4, 14, 10), cream, 0.4, 1.2, 0);
    part(new THREE.SphereGeometry(0.28, 10, 8), yellow, -0.13, 0.75, 0.42).scale.set(1, 0.65, 0.3);
    part(new THREE.SphereGeometry(0.3, 12, 8), orange, 0.78, 1.11, 0).scale.set(1.05, 0.3, 1.3);
    part(new THREE.SphereGeometry(0.045, 8, 6), dark, 0.61, 1.28, 0.29);
    part(new THREE.SphereGeometry(0.045, 8, 6), dark, 0.61, 1.28, -0.29);
    part(new THREE.ConeGeometry(0.38, 0.35, 8), blue, 0.4, 1.62, 0);
    part(new THREE.SphereGeometry(0.07, 8, 6), yellow, 0.4, 1.82, 0);
    for (const z of [-0.23, 0.23]) this.feet.push(part(new THREE.BoxGeometry(0.35, 0.08, 0.2), orange, 0.2, 0.1, z));

    // Stars and a distant paper planet
    for (let i = 0; i < 180; i++) {
      const a = i * 2.399;
      const y = -1 + ((i * 0.618) % 1) * 2;
      const r = 28;
      const k = Math.sqrt(1 - y * y);
      m(new THREE.SphereGeometry(0.035 + (i % 4) * 0.018, 12, 8), mat(i % 3 ? '#f5e8c4' : '#d9a98d'), k * Math.cos(a) * r, y * r + 9, k * Math.sin(a) * r);
    }
    m(new THREE.SphereGeometry(1.25, 12, 8), mat('#b87e79'), -13, 10, -17);
    m(new THREE.TorusGeometry(1.9, 0.045, 5, 40), mat('#e3c5a4'), -13, 10, -17, 1.15, 0.2, 0.2);

    // The three sounds: a pedestal, a floating orb, a halo
    for (const [kind, x, z, color] of SOUNDS) {
      const g = this.add(new THREE.Group());
      g.position.set(x, 0.3, z);
      m(new THREE.CylinderGeometry(0.45, 0.55, 0.18, 8), mat('#a48f79'), 0, 0, 0, 0, 0, 0, g);
      const orb = m(new THREE.IcosahedronGeometry(0.32, 0), mat(color), 0, 0.65, 0, 0, 0, 0, g);
      const halo = m(new THREE.TorusGeometry(0.48, 0.025, 5, 24), mat('#f5db9c'), 0, 0.65, 0, Math.PI / 2, 0, 0, g);
      g.userData = { kind, orb, halo };
      this.targets.push(g);
    }

    // Rain: an umbrella Pip holds up
    const umb = this.add(this.umbrella, duck);
    umb.position.set(0.05, 0, -0.15);
    umb.visible = false;
    m(new THREE.CylinderGeometry(0.035, 0.035, 1.65, 6), mat('#69504a'), 0.1, 1.4, -0.2, 0, 0, 0, umb);
    m(new THREE.SphereGeometry(0.83, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c98778'), 0.1, 2.18, -0.2, 0, 0, 0, umb).scale.y = 0.55;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      m(new THREE.CylinderGeometry(0.012, 0.012, 0.83, 4), mat('#f2d9bb'), 0.1 + Math.cos(a) * 0.38, 2.31, -0.2 + Math.sin(a) * 0.38, 0, -a, Math.PI / 2 - 0.2, umb);
    }

    // Wolves: three of them drift past in space suits
    const wolves = this.add(this.wolves);
    wolves.visible = false;
    for (let i = 0; i < 3; i++) {
      const w = this.add(new THREE.Group(), wolves);
      this.wolfModels.push(w);
      const suit = mat(i === 1 ? '#d3bd9e' : '#e9dec3');
      const p = (g: THREE.BufferGeometry, mt: THREE.Material, x: number, y: number, z: number, rz = 0) => m(g, mt, x, y, z, 0, 0, rz, w);
      p(new THREE.SphereGeometry(0.48, 10, 8), suit, 0, 0, 0).scale.set(1, 0.8, 0.72);
      p(new THREE.SphereGeometry(0.34, 10, 8), mat('#aaa89c'), 0.4, 0.22, 0).scale.set(1.15, 0.8, 0.8);
      for (const z of [-0.2, 0.2]) {
        p(new THREE.ConeGeometry(0.14, 0.33, 4), mat('#8d8d87'), 0.38, 0.55, z, -0.15);
        p(new THREE.SphereGeometry(0.035, 6, 4), dark, 0.62, 0.26, z * 1.25);
        p(new THREE.CapsuleGeometry(0.07, 0.3, 3, 6), suit, -0.08, -0.25, z * 1.8, 0.7);
        p(new THREE.CapsuleGeometry(0.08, 0.25, 3, 6), suit, -0.32, -0.31, z, -0.5);
      }
      p(new THREE.SphereGeometry(0.12, 8, 6), dark, 0.76, 0.18, 0).scale.set(1.4, 0.5, 0.75);
      p(new THREE.SphereGeometry(0.48, 16, 10), new THREE.MeshBasicMaterial({ color: 0xc2e2df, transparent: true, opacity: 0.18, depthWrite: false }), 0.4, 0.25, 0);
      p(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 12), mat('#b58c77'), 0.4, -0.04, 0);
      p(new THREE.ConeGeometry(0.19, 0.5, 7), mat('#999b91'), -0.6, 0.05, 0, -1.2);
    }

    // Storm: a glass dome with pink plasma filaments, like a novelty plasma globe
    const storm = this.add(this.storm);
    storm.visible = false;
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xf0c9e4, transparent: true, opacity: 0.11, roughness: 0.18, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    m(new THREE.SphereGeometry(6.35, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.08, 0, 0, 0, 0, storm);
    m(new THREE.TorusGeometry(6.35, 0.055, 8, 64), new THREE.MeshBasicMaterial({ color: 0xefbdd9, transparent: true, opacity: 0.7 }), 0, 0.1, 0, Math.PI / 2, 0, 0, storm);
    this.electrode = m(new THREE.SphereGeometry(0.26, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff9ddc }), 0, 0.6, 0, 0, 0, 0, storm);
    for (let i = 0; i < 10; i++) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 19), 3));
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: i % 3 === 0 ? 0xffd8f4 : 0xff67cb, transparent: true, opacity: 0.88 }));
      this.plasma.push(this.add(line, storm));
    }
  }

  private resetEffects() {
    this.umbrella.visible = false;
    this.wolves.visible = false;
    this.storm.visible = false;
  }

  /** Pip waddles to a sound; `arrive` fires when there. */
  walkTo(kind: MoonSound) {
    const target = this.targets.find((t) => t.userData.kind === kind);
    if (!target || this.walk) return;
    this.resetEffects();
    const duck = this.duck;
    const dx = duck.position.x - target.position.x;
    const dz = duck.position.z - target.position.z;
    const len = Math.hypot(dx, dz) || 1;
    const end = new THREE.Vector3(target.position.x + (dx / len) * 1.75, 0.1, target.position.z + (dz / len) * 1.75);
    const from = duck.position.clone();
    duck.rotation.y = -Math.atan2(end.z - from.z, end.x - from.x);
    const duration = this.reduced ? 0 : Math.max(800, Math.hypot(end.x - from.x, end.z - from.z) * 650);
    this.walk = { from, end, start: performance.now(), duration, kind };
    this.events.depart(kind);
  }

  private arrive(kind: MoonSound) {
    if (kind === 'rain') this.umbrella.visible = true;
    if (kind === 'wolves') {
      this.wolves.visible = true;
      this.wolvesStart = performance.now();
    }
    if (kind === 'storm') this.storm.visible = true;
    this.events.arrive(kind);
  }

  private pick(e: PointerEvent): MoonSound | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    let o: THREE.Object3D | null = this.ray.intersectObjects(this.targets, true)[0]?.object ?? null;
    while (o && !o.userData.kind) o = o.parent;
    return (o?.userData.kind as MoonSound) ?? null;
  }

  private onDown = (e: PointerEvent) => {
    this.down = [e.clientX, e.clientY];
  };

  private onUp = (e: PointerEvent) => {
    if (!this.down || Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 6) return;
    const kind = this.pick(e);
    if (kind) this.walkTo(kind);
  };

  private onMove = (e: PointerEvent) => {
    const over = !!this.pick(e);
    this.renderer.domElement.style.cursor = over ? 'pointer' : 'grab';
    this.events.hover(over);
  };

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const d = this.events.dir();
    if (d.x || d.y) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta -= d.x * 0.03;
      sph.phi = THREE.MathUtils.clamp(sph.phi + d.y * 0.02, this.controls.minPolarAngle, this.controls.maxPolarAngle);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    }
    this.controls.update();

    const { duck, feet, walk } = this;
    if (walk) {
      const p = walk.duration ? Math.min(1, (performance.now() - walk.start) / walk.duration) : 1;
      const step = Math.sin(p * walk.duration * 0.014);
      duck.position.lerpVectors(walk.from, walk.end, p);
      duck.position.y = 0.1 + Math.abs(step) * 0.1;
      duck.rotation.z = step * 0.09;
      feet[0].rotation.z = step * 0.5;
      feet[1].rotation.z = -feet[0].rotation.z;
      if (p >= 1) {
        this.walk = null;
        duck.rotation.z = 0;
        feet.forEach((f) => (f.rotation.z = 0));
        this.arrive(walk.kind);
      }
    } else if (!this.reduced) duck.position.y = 0.1 + Math.sin(t * 0.002) * 0.025;

    if (this.wolves.visible) {
      const el = (t - this.wolvesStart) * 0.001;
      this.wolfModels.forEach((w, i) => {
        w.position.set(-7 + ((el * 0.8 + i * 2.1) % 17), 4.1 + Math.sin(el * 1.4 + i) * 0.35, -4.6 - i * 0.4);
        w.rotation.z = Math.sin(el + i) * 0.13;
        w.rotation.y = 0.2;
      });
    }
    if (this.storm.visible) {
      // reduced motion: the filaments hold still instead of crackling
      const tt = this.reduced ? 0 : t;
      this.plasma.forEach((line, i) => {
        const pts = line.geometry.attributes.position as THREE.BufferAttribute;
        const angle = (i * Math.PI * 2) / 10 + Math.sin(tt * 0.00035 + i) * 0.23;
        const elev = 0.35 + (i % 4) * 0.23 + Math.sin(tt * 0.0007 + i) * 0.07;
        const end = new THREE.Vector3(Math.cos(angle) * Math.cos(elev) * 6.32, Math.sin(elev) * 6.32 + 0.08, Math.sin(angle) * Math.cos(elev) * 6.32);
        for (let j = 0; j < 19; j++) {
          const p = j / 18;
          const n1 = Math.sin(j * 17.3 + i * 8.4 + Math.floor(tt / 100) * 1.7) * 0.22 * Math.sin(Math.PI * p);
          const n2 = Math.sin(j * 8.7 + i * 3.2 + Math.floor(tt / 115) * 2.1) * 0.22 * Math.sin(Math.PI * p);
          pts.setXYZ(j, end.x * p + n1, 0.6 + (end.y - 0.6) * p + n2, end.z * p - n1);
        }
        pts.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).opacity = 0.55 + 0.4 * Math.abs(Math.sin(tt * 0.006 + i));
      });
      this.electrode.scale.setScalar(1 + 0.15 * Math.sin(tt * 0.008));
    }
    if (!this.reduced)
      this.targets.forEach((o, i) => {
        o.userData.orb.position.y = 0.7 + Math.sin(t * 0.002 + i) * 0.12;
        o.userData.halo.rotation.z = t * 0.0003;
      });
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.domElement.remove();
  }
}
