import * as THREE from 'three';

/** Render at 1/PIXEL resolution and scale up crisp, like the park and the arcade. */
const PIXEL = 3;
const G = 9.8;
/** the deck of the pier, metres above the water */
const DECK = 4;
/** the top of the lift hill: the park's 150 feet */
const TOP = 46;
/** where the lift ends, as a fraction of the way round */
const LIFT = 0.11;
/** the chain lift's pace, m/s */
const LIFT_SPEED = 5;
/** the station sits a little before the lift */
const STATION = 0.985;

/**
 * Track height at `u` (0..1 of the way round): up the lift, then rolling down in waves.
 * The two loops cross at u = 0 and u = 0.5 — low by the station, ~13 m higher mid-ride.
 */
function heightAt(u: number) {
  if (u < LIFT) return DECK + 2 + (TOP - DECK - 2) * (u / LIFT);
  const k = (1 - u) / (1 - LIFT);
  return DECK + 2 + (TOP - DECK - 2) * k * (0.78 + 0.22 * Math.cos((u - LIFT) * Math.PI * 2 * 4));
}

/** The figure eight, seen from above: two loops, north and south, crossing in the middle. */
function trackPoint(u: number, out = new THREE.Vector3()) {
  const s = u * Math.PI * 2;
  return out.set(38 * Math.sin(2 * s), heightAt(u), -52 * Math.sin(s));
}

/** a mesh, placed (and optionally adjusted) in one go */
function put<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, adjust?: (o: T) => void): T {
  o.position.set(x, y, z);
  adjust?.(o);
  return o;
}

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export interface FigureEightEvents {
  /** the train is back in the station */
  onFinished(): void;
  /** the chain dog clacking on the lift */
  onClack(): void;
}

/**
 * The Great Figure Eight at Luna Park, Duwamish Head, 1907, at dusk: a wooden scenic railway
 * on a white trestle over the pier, every rail strung with bulbs. You ride the front car
 * (drag to look round); with reduced motion you watch the train from the boardwalk instead.
 * The rest of the park stands where it does on the map; Elliott Bay all round, the Olympics
 * to the west, Queen Anne and the young city across the water, Rainier far to the southeast.
 */
export class FigureEightScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 6000);
  private curve: THREE.CatmullRomCurve3;
  private length: number;
  /** where the lift hill tops out, as a fraction of the track's length */
  private liftEnd = LIFT;
  private train = new THREE.Group();
  private u = STATION;
  private v = 0;
  private wait = 1.4;
  private done = false;
  private clackT = 0;
  private look = { yaw: 0, pitch: 0 };
  private dragging: { x: number; y: number } | null = null;
  private raf = 0;
  private last = 0;
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private events: FigureEightEvents,
    private watch: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.className = 'park-canvas';
    host.appendChild(el);

    const pts = Array.from({ length: 160 }, (_, i) => trackPoint(i / 160));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();
    for (let i = 0, best = 0; i < 400; i++) {
      const y = this.curve.getPointAt(i / 400).y;
      if (y > best) [best, this.liftEnd] = [y, i / 400];
    }

    this.buildSky();
    this.buildPier();
    this.buildTrack();
    this.buildTrain();
    if (watch) {
      this.camera.position.set(-70, DECK + 1.7, 62);
      this.camera.lookAt(0, 22, 0);
    }

    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Back to the station and round again. */
  restart() {
    this.u = STATION;
    this.v = 0;
    this.wait = 0.8;
    this.done = false;
  }

  // ---------- the world ----------

  private buildSky() {
    const s = this.scene;
    s.fog = new THREE.Fog('#d9a58a', 400, 3200);
    // a dusk sky: gold at the horizon in the west, deep blue overhead
    const sky = new THREE.SphereGeometry(5000, 24, 12);
    const colors: number[] = [];
    const pos = sky.attributes.position;
    const low = new THREE.Color('#f3b26b');
    const mid = new THREE.Color('#c97a8a');
    const high = new THREE.Color('#2a2f63');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 5000;
      const west = Math.max(0, -pos.getX(i) / 5000);
      if (y < 0.15) c.copy(low).lerp(mid, Math.max(0, y) / 0.15 * (1 - west * 0.6));
      else c.copy(mid).lerp(high, Math.min(1, (y - 0.15) / 0.5));
      colors.push(c.r, c.g, c.b);
    }
    sky.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    s.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
    // the sun going down behind the Olympics
    const sun = new THREE.Mesh(new THREE.CircleGeometry(90, 16), new THREE.MeshBasicMaterial({ color: '#ffe2a0', fog: false }));
    sun.position.set(-4200, 260, 600);
    sun.lookAt(0, 0, 0);
    s.add(sun);

    s.add(new THREE.HemisphereLight('#ffd6b0', '#2a3a55', 1.2));
    const dir = new THREE.DirectionalLight('#ffc28a', 1.4);
    dir.position.set(-300, 120, 80);
    s.add(dir);

    // Elliott Bay and the Sound
    const water = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), lambert('#3f6f7a'));
    water.rotation.x = -Math.PI / 2;
    s.add(water);

    // ridgelines: the Olympics (west, snow on top), the city's hills (northeast), Rainier (southeast)
    const ridge = (fromDeg: number, toDeg: number, r: number, height: number, jag: number, color: string, snow?: string) => {
      const n = 60;
      const geo = new THREE.BufferGeometry();
      const v: number[] = [];
      const col: number[] = [];
      const base = new THREE.Color(color);
      const top = new THREE.Color(snow ?? color);
      let seed = Math.round(fromDeg * 7 + r);
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= n; i++) {
        const a = THREE.MathUtils.degToRad(fromDeg + ((toDeg - fromDeg) * i) / n);
        const h = height * (0.55 + 0.45 * Math.sin((i / n) * Math.PI)) * (1 - jag + jag * rnd());
        const p: [number, number, number] = [Math.sin(a) * r, h, -Math.cos(a) * r];
        if (prev) {
          v.push(prev[0], 0, prev[2], p[0], 0, p[2], p[0], p[1], p[2], prev[0], 0, prev[2], p[0], p[1], p[2], prev[0], prev[1], prev[2]);
          const cp = prev[1] > height * 0.75 ? top : base;
          const cn = p[1] > height * 0.75 ? top : base;
          col.push(...base.toArray(), ...base.toArray(), ...cn.toArray(), ...base.toArray(), ...cn.toArray(), ...cp.toArray());
        }
        prev = p;
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    };
    ridge(225, 330, 3000, 260, 0.5, '#5a5a7a', '#e8e4f0'); // Olympics
    ridge(10, 75, 3200, 70, 0.2, '#4a5a4a'); // Queen Anne, Capitol Hill
    ridge(120, 140, 4200, 520, 0.05, '#7a7a96', '#f3f0f6'); // Rainier

    // Seattle in 1907, low across the water to the northeast: a few blocks and a lot of smoke
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const town = new THREE.Group();
    for (let i = 0; i < 70; i++) {
      const a = THREE.MathUtils.degToRad(30 + rnd() * 40);
      const r = 2600 + rnd() * 500;
      const h = 8 + rnd() * rnd() * 40;
      const b = new THREE.Mesh(new THREE.BoxGeometry(20 + rnd() * 40, h, 20 + rnd() * 30), lambert(rnd() < 0.5 ? '#6a5a5a' : '#7a6a60'));
      b.position.set(Math.sin(a) * r, h / 2, -Math.cos(a) * r);
      town.add(b);
    }
    s.add(town);
  }

  /** The boardwalk and the rest of the park, where they stand on the map (metres from the coaster). */
  private buildPier() {
    const s = this.scene;
    const deckTex = (() => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const g = c.getContext('2d')!;
      g.fillStyle = '#b98a5a';
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#a3764a';
      for (let y = 2; y < 16; y += 3) g.fillRect(0, y, 16, 1);
      g.fillStyle = '#8a5f3a';
      g.fillRect(5, 0, 1, 2);
      g.fillRect(12, 6, 1, 2);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(60, 30);
      return t;
    })();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(300, DECK, 144), [
      lambert('#6a4a30'), lambert('#6a4a30'), new THREE.MeshLambertMaterial({ map: deckTex }), lambert('#6a4a30'), lambert('#6a4a30'), lambert('#6a4a30'),
    ]);
    deck.position.set(-108, DECK / 2, 6);
    s.add(deck);
    // pilings along the edges
    const pile = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.35, DECK + 2, 5), lambert('#3a2a1e'), 140);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let x = -256; x <= 40; x += 6) {
      m.makeTranslation(x, DECK / 2 - 1, 78.5);
      pile.setMatrixAt(n++, m);
      m.makeTranslation(x, DECK / 2 - 1, -66.5);
      pile.setMatrixAt(n++, m);
    }
    pile.count = n;
    s.add(pile);

    const bulbs: number[] = [];
    const string = (a: THREE.Vector3, b: THREE.Vector3, gap = 2) => {
      const k = Math.max(1, Math.round(a.distanceTo(b) / gap));
      for (let i = 0; i <= k; i++) bulbs.push(...a.clone().lerp(b, i / k).toArray());
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // the railing round the deck, strung with bulbs
    string(V(-258, DECK + 1, -66), V(42, DECK + 1, -66), 3);
    string(V(42, DECK + 1, -66), V(42, DECK + 1, 78), 3);
    string(V(-258, DECK + 1, -66), V(-258, DECK + 1, 78), 3);

    const white = lambert('#f3ede0');
    const red = lambert('#b8322a');
    const green = lambert('#3f8f5a');
    // the carousel: a green three-tier pagoda roof on gold posts
    const carousel = new THREE.Group();
    carousel.add(put(new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.6, 16), lambert('#c9a26b')), 0, 0.3, 0));
    for (const [r, h, y] of [[12, 3, 6], [8, 2.5, 8.6], [4.5, 2.5, 10.8]] as const) {
      carousel.add(put(new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), green), 0, y, 0));
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        bulbs.push(Math.cos(a) * r - 114, DECK + y - h / 2, Math.sin(a) * r + 6);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      carousel.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.6, 4), lambert('#e6b23a')), Math.cos(a) * 8, 2.6, Math.sin(a) * 8));
    }
    carousel.position.set(-114, DECK, 6);
    s.add(carousel);
    // the Giant Whirl: a striped mast and cars on long arms
    const whirl = new THREE.Group();
    whirl.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 24, 6), red), 0, 12, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      whirl.add(put(new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.4), lambert(['#b8322a', '#e6b23a', '#5fa8a0'][i % 3])), Math.cos(a) * 11, 9, Math.sin(a) * 11));
    }
    whirl.position.set(-174, DECK, 6);
    s.add(whirl);
    // the Natatorium: a long white hall with a red roof
    const nat = new THREE.Group();
    nat.add(put(new THREE.Mesh(new THREE.BoxGeometry(104, 14, 34), white), 0, 7, 0));
    nat.add(put(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 18, 10, 4, 1), lambert('#8a3a2a')), 0, 19, 0, (m) => { m.scale.set(4.1, 1, 1); m.rotation.y = Math.PI / 4; }));
    nat.position.set(-108, DECK, -48);
    s.add(nat);
    string(V(-160, DECK + 14, -30.9), V(-56, DECK + 14, -30.9), 2.5);
    // the Shoot-the-Chutes tower, its slide, and the splash pool
    const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 36, 10), white);
    tower.position.set(-228, DECK + 18, -54);
    s.add(tower);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 90), lambert('#e8d2a8'));
    slide.position.set(-228, DECK + 18, -8);
    slide.rotation.x = Math.atan2(36, 90);
    s.add(slide);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(56, 0.4, 40), lambert('#2d6a72'));
    pool.position.set(-228, DECK + 0.2, 52);
    s.add(pool);
    string(V(-233, DECK + 36, -54), V(-233, DECK, -54), 2);
    string(V(-223, DECK + 36, -54), V(-223, DECK, -54), 2);
    // the gate: two white towers with red domes, the arch between
    for (const x of [-90, -54]) {
      s.add(put(new THREE.Mesh(new THREE.BoxGeometry(8, 18, 8), white), x, DECK + 9, 72));
      s.add(put(new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), red), x, DECK + 18, 72));
      string(V(x - 4, DECK + 18, 76.1), V(x - 4, DECK, 76.1), 1.5);
      string(V(x + 4, DECK + 18, 76.1), V(x + 4, DECK, 76.1), 1.5);
    }
    s.add(put(new THREE.Mesh(new THREE.BoxGeometry(28, 4, 2), red), -72, DECK + 16, 72));
    string(V(-86, DECK + 18.2, 73), V(-58, DECK + 18.2, 73), 1.2);

    this.addBulbs(bulbs);
  }

  private buildTrack() {
    const s = this.scene;
    const N = Math.round(this.length / 1.5);
    const ties: THREE.Matrix4[] = [];
    const tieUp = new THREE.Vector3();
    const railL: number[] = [];
    const railR: number[] = [];
    const bulbs: number[] = [];
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const prev: THREE.Vector3[] = [];
    const posts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const u = (i % N) / N;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      side.crossVectors(t, up).normalize();
      const l = p.clone().addScaledVector(side, -0.9);
      const r = p.clone().addScaledVector(side, 0.9);
      if (prev.length) {
        const [pl, pr] = prev;
        const rail = (a: THREE.Vector3, b: THREE.Vector3, out: number[]) => {
          const a2 = a.clone().setY(a.y + 0.2);
          const b2 = b.clone().setY(b.y + 0.2);
          out.push(...a.toArray(), ...b.toArray(), ...b2.toArray(), ...a.toArray(), ...b2.toArray(), ...a2.toArray());
        };
        rail(pl, l, railL);
        rail(pr, r, railR);
      }
      // an open crosstie every metre and a half, square to the track
      tieUp.crossVectors(side, t).normalize();
      ties.push(new THREE.Matrix4().makeBasis(side, tieUp, t).setPosition(p.x, p.y - 0.08, p.z));
      prev[0] = l;
      prev[1] = r;
      if (i % 2 === 0) posts.push(l.clone(), r.clone());
      if (i % 2 === 0) bulbs.push(l.x, l.y + 0.45, l.z, r.x, r.y + 0.45, r.z);
    }
    const mesh = (v: number[], color: string) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      s.add(new THREE.Mesh(g, lambert(color, { side: THREE.DoubleSide })));
    };
    const tie = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.16, 0.35), lambert('#8a5f3a'), ties.length);
    ties.forEach((m, i) => tie.setMatrixAt(i, m));
    s.add(tie);
    mesh(railL, '#3a2a22');
    mesh(railR, '#3a2a22');

    // the white trestle: a post under each rail every few metres, braced across
    const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1, 0.3), lambert('#efe6d6'), posts.length);
    const brace = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 0.2), lambert('#d6ccb8'), posts.length * 8);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let nb = 0;
    posts.forEach((top, i) => {
      const h = top.y - DECK;
      m.compose(new THREE.Vector3(top.x, DECK + h / 2 - 0.1, top.z), q.identity(), new THREE.Vector3(1, h, 1));
      post.setMatrixAt(i, m);
      if (i % 2 === 1) {
        const a = posts[i - 1];
        const mid = a.clone().add(top).multiplyScalar(0.5);
        const yaw = Math.atan2(top.x - a.x, top.z - a.z);
        q.setFromEuler(new THREE.Euler(0, yaw - Math.PI / 2, 0));
        for (let y = DECK + 4; y < Math.min(a.y, top.y) - 1 && nb < posts.length * 8; y += 5) {
          m.compose(new THREE.Vector3(mid.x, y, mid.z), q, new THREE.Vector3(1.8, 1, 1));
          brace.setMatrixAt(nb++, m);
        }
      }
    });
    brace.count = nb;
    s.add(post, brace);
    this.addBulbs(bulbs);
  }

  private addBulbs(v: number[]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffe9a8', size: 2, sizeAttenuation: false, fog: false })));
  }

  private buildTrain() {
    const red = lambert('#b8322a');
    const trim = lambert('#e6b23a');
    for (let k = 0; k < 3; k++) {
      const car = new THREE.Group();
      car.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 2.6), red));
      car.add(put(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 2.7), trim), 0, 0.45, 0));
      car.userData.k = k;
      this.train.add(car);
    }
    this.scene.add(this.train);
    this.train.visible = this.watch;
    // riding: the lip of the front car in front of you
    if (!this.watch) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.3), red);
      lip.position.set(0, -0.75, -0.9);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), trim);
      bar.position.set(0, -0.5, -0.75);
      this.camera.add(lip, bar);
      this.scene.add(this.camera);
    }
  }

  // ---------- riding ----------

  private step(dt: number) {
    if (this.done) return;
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    const at = (this.u + 1) % 1;
    const h = this.curve.getPointAt(at).y;
    if (at >= STATION || at < this.liftEnd) {
      // the chain lift: a steady walking pace, clacking
      this.v = LIFT_SPEED;
      this.clackT += dt;
      if (this.clackT > 0.35) {
        this.clackT = 0;
        this.events.onClack();
      }
    } else {
      // gravity, minus a bit lost to the wood; brakes on the run back into the station
      const free = Math.sqrt(LIFT_SPEED * LIFT_SPEED + 2 * G * Math.max(0, TOP - h)) * 0.86;
      this.v = at > STATION - 0.05 ? Math.max(1.2, this.v - 14 * dt) : free;
    }
    const before = this.u;
    this.u = (this.u + (this.v * dt) / this.length) % 1;
    // back to the station: the ride is over
    if (before < STATION && this.u >= STATION && before > 0.5) {
      this.u = STATION;
      this.v = 0;
      this.done = true;
      this.events.onFinished();
    }
  }

  private placeTrain() {
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (const car of this.train.children) {
      const k = car.userData.k as number;
      const u = (this.u - (k * 3) / this.length + 1) % 1;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      car.position.copy(p).setY(p.y + 0.6);
      car.lookAt(p.clone().add(t).setY(p.y + 0.6 + t.y));
    }
  }

  private placeCamera() {
    if (this.watch) {
      this.camera.lookAt(this.train.children[0].position);
      return;
    }
    const u = this.u;
    const p = this.curve.getPointAt(u);
    const ahead = this.curve.getPointAt((u + 6 / this.length) % 1);
    this.camera.position.copy(p).setY(p.y + 1.55);
    const target = ahead.setY(ahead.y + 1.2);
    this.camera.lookAt(target);
    // a lean into the turns, and wherever you're looking
    const t = this.curve.getTangentAt(u);
    const t2 = this.curve.getTangentAt((u + 4 / this.length) % 1);
    const turn = t.x * t2.z - t.z * t2.x;
    this.camera.rotateZ(THREE.MathUtils.clamp(turn * 4, -0.22, 0.22));
    this.camera.rotateY(this.look.yaw);
    this.camera.rotateX(this.look.pitch);
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (time - (this.last || time)) / 1000);
    this.last = time;
    this.step(dt);
    this.placeTrain();
    this.placeCamera();
    // let go and your gaze drifts back to the track ahead
    if (!this.dragging) {
      this.look.yaw *= 1 - Math.min(1, dt * 1.5);
      this.look.pitch *= 1 - Math.min(1, dt * 1.5);
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  // ---------- looking round ----------

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
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
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
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.InstancedMesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
