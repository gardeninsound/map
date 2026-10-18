import * as THREE from 'three';
import type { ArtAsset } from '../../content/types';
import type { ParkSign } from '../../content/puppyPark';

/** Render at 1/PIXEL resolution and scale up crisp, like the cup and the map. */
const PIXEL = 3;
const EYE = 1.6; // metres
const WALK = 3.2; // m/s
const RUN = 6;
const TURN = 1.9; // rad/s with the arrow keys
const READ_DIST = 3.4; // how close you need to be to read a sign
/** The walkable lot, metres: x east–west, z north(−)–south(+, toward the street). */
const LOT = { minX: -21, maxX: 21, minZ: -15, maxZ: 19 };

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/** Deterministic noise so the field looks the same every visit. */
function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export interface ParkEvents {
  /** the sign you're close to and facing, or null */
  onNear(index: number | null): void;
}

export class ParkScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  private pos = new THREE.Vector3(0, EYE, 17.5);
  private yaw = 0; // 0 = looking north (−z), into the lot
  private pitch = 0.05;
  private move = { forward: 0, turn: 0, run: false };
  private dragging: { x: number; y: number } | null = null;
  private signSpots: { x: number; z: number; normal: THREE.Vector3 }[] = [];
  private near: number | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;
  paused = false;

  constructor(
    private host: HTMLElement,
    private events: ParkEvents,
    signs: ParkSign[],
    assets: Record<string, ArtAsset>,
    artUrl: (id: string) => string,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.className = 'park-canvas';
    host.appendChild(el);

    this.buildWorld();
    signs.forEach((s) => this.buildSign(s, assets[s.asset], artUrl(s.asset)));

    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** forward −1..1, turn −1..1 (arrow keys / D-pad), polled by the React side each frame */
  setMove(forward: number, turn: number, run: boolean) {
    this.move = { forward, turn, run };
  }

  private buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color('#8ec5ff');
    s.fog = new THREE.Fog('#cfe6ff', 45, 120);
    s.add(new THREE.HemisphereLight('#ffffff', '#6f7f5a', 1.7));
    const sun = new THREE.DirectionalLight('#fff3d6', 1.7);
    sun.position.set(-20, 30, 15);
    s.add(sun);

    // Grass, with sunburnt patches like the August photos.
    const r = rand(7);
    const grass = canvasTexture(64, 64, (g) => {
      g.fillStyle = '#86c45a';
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 420; i++) {
        g.fillStyle = ['#6fae47', '#9bd36b', '#b9c26a', '#c9b56a'][Math.floor(r() * 4)];
        g.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 1, 2);
      }
    }, [14, 14]);
    const field = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), new THREE.MeshLambertMaterial({ map: grass }));
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0, 2);
    s.add(field);
    for (let i = 0; i < 9; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(2 + r() * 3, 7), lambert('#c8b46a'));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(-18 + r() * 36, 0.01, -12 + r() * 24);
      s.add(patch);
    }
    // Gravel strip, sidewalk, curb, 40th Ave SW.
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(60, 2.5), lambert('#a9a59b'));
    gravel.rotation.x = -Math.PI / 2;
    gravel.position.set(0, 0.015, 15.6);
    s.add(gravel);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(80, 0.12, 3), lambert('#d9d6de'));
    walk.position.set(0, 0.06, 18.5);
    s.add(walk);
    const street = new THREE.Mesh(new THREE.PlaneGeometry(120, 11), lambert('#5f5c78'));
    street.rotation.x = -Math.PI / 2;
    street.position.set(0, 0.005, 25.5);
    s.add(street);
    for (let x = -50; x < 50; x += 5) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.15), lambert('#ffd34d'));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, 25.5);
      s.add(dash);
    }
    const carColors = ['#2b2b38', '#e9e9ef', '#3a6fd8', '#8d8a9e', '#e0322b'];
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 1.8), lambert(carColors[i % carColors.length]));
      body.position.y = 0.65;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.6), lambert('#2b3b5c'));
      cab.position.set(-0.2, 1.4, 0);
      car.add(body, cab);
      car.position.set(-26 + i * 9.5 + r() * 2, 0, 21.6);
      s.add(car);
    }

    // Apartment blocks on three sides — the "seven+ stories" already arriving.
    const block = (w: number, h: number, d: number, x: number, z: number, wall: string, face: number) => {
      // One texture tile = one 6 m bay of one 3.2 m floor: two windows and a floor line.
      const windows = canvasTexture(32, 16, (g) => {
        g.fillStyle = wall;
        g.fillRect(0, 0, 32, 16);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(0, 15, 32, 1);
        for (const wx of [4, 18]) {
          g.fillStyle = '#4a6080';
          g.fillRect(wx, 4, 10, 8);
          g.fillStyle = '#8fb3d9';
          g.fillRect(wx + 1, 5, 3, 3);
        }
      }, [Math.round(w / 6), Math.round(h / 3.2)]);
      windows.minFilter = THREE.NearestFilter;
      const plain = lambert(wall);
      const facade = new THREE.MeshLambertMaterial({ map: windows });
      // BoxGeometry faces: +x, −x, +y, −y, +z, −z
      const mats = [plain, plain, plain, plain, plain, plain];
      mats[face] = facade;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      m.position.set(x, h / 2, z);
      s.add(m);
    };
    block(64, 22, 12, 0, -24, '#d8d2c4', 4);
    block(14, 19, 40, -30, 0, '#c2c6cf', 0);
    block(12, 16, 36, 29, -2, '#e8d48a', 1);
    block(28, 12, 10, -22, 38, '#bfc5d1', 5);
    block(26, 14, 10, 18, 38, '#d4ccbc', 5);

    // Orange construction fencing along the back-left.
    const net = canvasTexture(16, 16, (g) => {
      g.clearRect(0, 0, 16, 16);
      g.fillStyle = '#ff6a1a';
      for (let i = 0; i < 16; i += 4) {
        g.fillRect(0, i, 16, 1.5);
        g.fillRect(i, 0, 1.5, 16);
      }
    }, [12, 1]);
    const fenceMat = new THREE.MeshLambertMaterial({ map: net, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const fence = (x: number, z: number, len: number, rot: number) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.2), fenceMat);
      f.position.set(x, 0.6, z);
      f.rotation.y = rot;
      s.add(f);
      for (let i = -len / 2; i <= len / 2; i += 3) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 4), lambert('#5a5a5a'));
        post.position.set(x + Math.cos(rot) * i, 0.65, z - Math.sin(rot) * i);
        s.add(post);
      }
    };
    fence(-11, -11, 18, 0);
    fence(-20, -4, 14, Math.PI / 2);

    // A few trees.
    for (const [x, z, h] of [[18, 14, 6], [-19, 13, 5], [16, -12, 7], [24, 18, 5]]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, h * 0.45, 6), lambert('#7a4b2a'));
      trunk.position.set(x, h * 0.22, z);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.35, 0), lambert('#3fa34d'));
      top.position.set(x, h * 0.65, z);
      s.add(trunk, top);
    }
  }

  private buildSign(sign: ParkSign, asset: ArtAsset | undefined, url: string) {
    const [l, t, r, b] = sign.crop;
    const aspect = asset ? ((r - l) * asset.w) / ((b - t) * asset.h) : 1;
    const w = sign.width;
    const h = w / aspect;
    const g = new THREE.Group();
    const bottom = sign.posts === 'pink' ? 0.9 : 1.0;

    // Board: photo on the front, plain white edges and back. Until the photo loads (or if
    // the art isn't deployed) the face shows the photo's dominant colour.
    const face = new THREE.MeshLambertMaterial({ color: asset?.color ?? '#f4f0e8' });
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.offset.set(l, 1 - b);
      tex.repeat.set(r - l, b - t);
      face.map = tex;
      face.color.set('#ffffff');
      face.needsUpdate = true;
    });
    const edge = lambert('#f4f2ee');
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [edge, edge, edge, edge, face, edge]);
    board.position.y = bottom + h / 2;
    g.add(board);

    const postMat = lambert(sign.posts === 'pink' ? '#f4a7b9' : '#8a5a34');
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, bottom + h + 0.05, 0.1), postMat);
      post.position.set(side * (w / 2 - 0.02), (bottom + h + 0.05) / 2, -0.06);
      g.add(post);
    }
    const yaw = (sign.facing * Math.PI) / 180;
    g.position.set(sign.x, 0, sign.z);
    g.rotation.y = yaw;
    this.scene.add(g);
    this.signSpots.push({ x: sign.x, z: sign.z, normal: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)) });
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw += (e.clientX - this.dragging.x) * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.dragging.y) * 0.004, -0.9, 0.9);
    this.dragging = { x: e.clientX, y: e.clientY };
  };

  private onUp = () => {
    this.dragging = null;
  };

  private update(dt: number) {
    if (this.paused) return;
    this.yaw += this.move.turn * TURN * dt;
    const speed = (this.move.run ? RUN : WALK) * dt * this.move.forward;
    const nx = this.pos.x + Math.sin(this.yaw) * speed;
    const nz = this.pos.z - Math.cos(this.yaw) * speed;
    // Stay in the lot (and on the sidewalk), and don't walk through the signs.
    const blocked = this.signSpots.some((p) => Math.hypot(p.x - nx, p.z - nz) < 0.7);
    if (!blocked) {
      this.pos.x = THREE.MathUtils.clamp(nx, LOT.minX, LOT.maxX);
      this.pos.z = THREE.MathUtils.clamp(nz, LOT.minZ, LOT.maxZ);
    }

    // Which sign are you reading? Close, in front of its face, and roughly looking at it.
    const look = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let near: number | null = null;
    let best = READ_DIST;
    this.signSpots.forEach((p, i) => {
      const to = new THREE.Vector3(p.x - this.pos.x, 0, p.z - this.pos.z);
      const d = to.length();
      if (d > best) return;
      to.normalize();
      const inFront = -to.dot(p.normal) > 0.2; // you're on the painted side
      const looking = to.dot(look) > 0.55;
      if (inFront && looking) {
        best = d;
        near = i;
      }
    });
    if (near !== this.near) {
      this.near = near;
      this.events.onNear(near);
    }
  }

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(Math.ceil(w / PIXEL), Math.ceil(h / PIXEL), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = (t: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    this.update(dt);
    // gentle head bob while walking
    const bob = this.move.forward ? Math.sin(t / 140) * 0.03 : 0;
    this.camera.position.set(this.pos.x, EYE + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, -this.yaw, 0, 'YXZ');
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('resize', this.resize);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          (m as THREE.MeshLambertMaterial).map?.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
