import * as THREE from 'three';
import { BEAR_GAME, type ArcadeGame } from '../../content/duckArcade';
import { besideYou, easeAngle, lookYaw, route, yawTo, type Obstacle, type Spot } from '../../game/arcadeBear';
import { ArcadeBear } from './ArcadeBear';

/** Render at 1/PIXEL resolution and scale up crisp, like the park and the map. */
const PIXEL = 3;
const EYE = 1.55; // metres
const WALK = 2.8; // m/s
const RUN = 4.5;
const TURN = 2.0; // rad/s with the arrow keys
const PLAY_DIST = 2.4; // how close you stand to play a cabinet
/** The room, metres: x across, z from the back wall (−) to the front doors (+). */
const ROOM = { minX: -7, maxX: 7, minZ: -6.5, maxZ: 4.5, h: 4 };
const MARGIN = 0.45;

/** Where cabinets stand (x, z, facing yaw: 0 faces +z, toward the doors), filled in order. */
const SLOTS: [number, number, number][] = [
  [-4.5, -5.9, 0],
  [-1.5, -5.9, 0],
  [1.5, -5.9, 0],
  [4.5, -5.9, 0],
  [-6.3, -3, Math.PI / 2],
  [6.3, -3, -Math.PI / 2],
  [-6.3, -0.2, Math.PI / 2],
  [6.3, -0.2, -Math.PI / 2],
  // out on the floor near the doors, side on: the bear's Avocado Drop
  [3.6, 1.6, -Math.PI / 2],
];
/** open floor the bear can walk through to get round things */
const AISLES: Spot[] = [
  { x: 0, z: -3.8 }, { x: 0, z: -0.5 }, { x: 0, z: 2.8 }, { x: -3.4, z: -1.6 }, { x: 3, z: -1.6 }, { x: -1.6, z: 1.2 }, { x: 1.8, z: 3.4 },
];

/**
 * Pop-art posters on the open wall (public/arcade/posters/, cut from two four-up sheets):
 * file, pixel size, then x, z, facing yaw. On the front wall, two pairs flank the doors; each
 * side wall has one near the front and one in the back corner, clear of the cabinets.
 */
export const POSTERS: [string, number, number, number, number, number][] = [
  ['poster-blue', 413, 557, -7 + 0.03, 2.3, Math.PI / 2],
  ['poster-pink', 412, 557, 7 - 0.03, 2.3, -Math.PI / 2],
  ['poster-yellow', 413, 541, -3, 4.5 - 0.03, Math.PI],
  ['poster-green', 412, 541, 3, 4.5 - 0.03, Math.PI],
  // the second sheet
  ['poster-bolt', 410, 549, -7 + 0.03, -5.2, Math.PI / 2],
  ['poster-stock', 410, 549, 7 - 0.03, -5.2, -Math.PI / 2],
  ['poster-shag', 410, 549, -5.5, 4.5 - 0.03, Math.PI],
  ['poster-guitar', 410, 549, 5.5, 4.5 - 0.03, Math.PI],
];
/** poster width, metres; each hangs centred between the wainscot and the neon stripe */
const POSTER_W = 0.85;
const POSTER_Y = 1.92;

const FONT = '"Press Start 2P", monospace';

const lambert = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const glow = (color: string) => new THREE.MeshBasicMaterial({ color });

function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/** A rubber duck facing right, 8×7, for screens and the carpet. */
const DUCK = ['...kkk..', '..kyyyk.', '..kyekoo', 'k.kyyyk.', 'kykyyyyk', 'kyyyyyyk', '.kkkkkk.'];
function paintDuck(g: CanvasRenderingContext2D, x: number, y: number, s: number, body = '#ffd23f') {
  const colors: Record<string, string> = { k: '#1c1b22', y: body, e: '#1c1b22', o: '#f47b20' };
  DUCK.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (!colors[ch]) return;
      g.fillStyle = colors[ch];
      g.fillRect(x + i * s, y + j * s, s, s);
    }),
  );
}

/** An avocado half, 5×7: green skin, pale flesh, a brown pit. */
const AVOCADO = ['.ggg.', 'glllg', 'glllg', 'glplg', 'glppg', 'glllg', '.ggg.'];
function paintAvocado(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const colors: Record<string, string> = { g: '#3f6b2a', l: '#d8e89a', p: '#7a4a26' };
  AVOCADO.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (!colors[ch]) return;
      g.fillStyle = colors[ch];
      g.fillRect(x + i * s, y + j * s, s, s);
    }),
  );
}

/** A cabinet's screen while the bear plays it: avocados dropping into a basket, its score going up. */
function paintPlaying(g: CanvasRenderingContext2D, c: ArcadeGame['colors'], t: number) {
  g.fillStyle = '#10131f';
  g.fillRect(0, 0, 96, 50);
  for (let i = 0; i < 3; i++) {
    const fall = (t * 0.6 + i * 0.37) % 1;
    paintAvocado(g, 14 + i * 30, Math.round(-14 + fall * 56), 2);
  }
  // the basket, sliding under them
  g.fillStyle = '#c8873a';
  g.fillRect(Math.round(38 + Math.sin(t * 2.4) * 30), 44, 18, 5);
  g.fillStyle = c.screen;
  g.fillRect(0, 50, 96, 22);
  centredText(g, `BEAR ${String(Math.floor(t * 7) % 10000).padStart(4, '0')}`, 48, 57, '#1c1b22');
}

function centredText(g: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string, size = 8) {
  g.font = `${size}px ${FONT}`;
  g.textBaseline = 'top';
  g.fillStyle = color;
  const w = g.measureText(text).width;
  g.fillText(text, Math.round(cx - w / 2), y);
}

export interface ArcadeEvents {
  /** the cabinet you're standing at and facing, or null */
  onNear(index: number | null): void;
  /** you clicked (or tapped) the bear's bag of licorice */
  onLicorice?(): void;
}

interface Cabinet {
  game: ArcadeGame;
  x: number;
  z: number;
  /** unit vector out of the screen */
  normal: THREE.Vector3;
  screen: THREE.CanvasTexture;
  paint(blink: boolean, t: number): void;
  /** the bear is playing it: its screen shows the game going */
  playing: boolean;
}

/**
 * The inside of the Duck Arcade, first person: neon-trimmed teal walls, duck-print carpet,
 * a giant rubber duck on a plinth, and a cabinet per game around the walls. Face a cabinet
 * up close and the React side offers to play it.
 */
export class ArcadeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(64, 1, 0.1, 100);
  private pos = new THREE.Vector3(0, EYE, 3.2);
  private yaw = 0; // 0 = looking toward the back wall (−z)
  private pitch = -0.02;
  private move = { forward: 0, turn: 0, run: false };
  private dragging: { x: number; y: number } | null = null;
  private cabinets: Cabinet[] = [];
  private duck = new THREE.Group();
  private bear = new ArcadeBear();
  /** turn your head to follow the bear: while it comes over and talks ('talk'), and as it
   * walks off to its game ('follow', until it starts playing or you move) */
  private watchBear: false | 'talk' | 'follow' = false;
  private raycaster = new THREE.Raycaster();
  private downAt: { x: number; y: number } | null = null;
  private near: number | null = null;
  private raf = 0;
  private last = 0;
  private lastBlink = -1;
  private disposed = false;
  paused = false;

  constructor(
    private host: HTMLElement,
    private events: ArcadeEvents,
    games: ArcadeGame[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.className = 'park-canvas';
    host.appendChild(el);

    this.buildRoom();
    games.slice(0, SLOTS.length).forEach((g, i) => this.buildCabinet(g, SLOTS[i]));
    this.scene.add(this.bear.group);

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

  private buildRoom() {
    const s = this.scene;
    const { minX, maxX, minZ, maxZ, h } = ROOM;
    const W = maxX - minX;
    const D = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    s.background = new THREE.Color('#120e1f');
    s.fog = new THREE.Fog('#120e1f', 14, 30);
    s.add(new THREE.HemisphereLight('#c9b8ff', '#2a1f3a', 1.1));
    for (const [x, z, c] of [[-4, -4, '#ff7eb6'], [4, -4, '#7fd9c4'], [0, 2, '#ffd23f']] as const) {
      const p = new THREE.PointLight(c, 18, 14, 1.6);
      p.position.set(x, h - 0.6, z);
      s.add(p);
    }

    // Carpet: deep purple, neon confetti and little ducks, the classic arcade floor.
    const carpet = canvasTexture(64, 64, (g) => {
      g.fillStyle = '#2a1f3a';
      g.fillRect(0, 0, 64, 64);
      const bits = ['#ff7eb6', '#7fd9c4', '#ffd23f', '#9b6ad1'];
      let r = 3;
      const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = bits[i % bits.length];
        const x = Math.floor(rnd() * 62), y = Math.floor(rnd() * 62);
        if (i % 3) g.fillRect(x, y, 2, 1);
        else g.fillRect(x, y, 1, 3);
      }
      paintDuck(g, 8, 10, 1);
      paintDuck(g, 40, 38, 1, '#ff7eb6');
    }, [W / 2, D / 2]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: carpet }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    s.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), lambert('#1d1830'));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, h, cz);
    s.add(ceiling);
    for (let x = minX + 3; x < maxX; x += 5) {
      for (let z = minZ + 2.5; z < maxZ; z += 4) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), glow('#fff3d6'));
        panel.rotation.x = Math.PI / 2;
        panel.position.set(x, h - 0.01, z);
        s.add(panel);
      }
    }

    // Walls: pond teal with a dark wainscot and a neon stripe all the way round.
    const wallTex = canvasTexture(16, 32, (g) => {
      g.fillStyle = '#2e8f8a';
      g.fillRect(0, 0, 16, 32);
      g.fillStyle = '#226f6b';
      g.fillRect(0, 0, 1, 32);
      g.fillStyle = '#1d4f4c';
      g.fillRect(0, 22, 16, 10);
    }, [W / 2, 1]);
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
    const wall = (w: number, x: number, z: number, rotY: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, h / 2, z);
      m.rotation.y = rotY;
      s.add(m);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.08), glow('#ff7eb6'));
      stripe.position.set(x, 2.75, z);
      stripe.rotation.y = rotY;
      stripe.translateZ(0.01);
      s.add(stripe);
      const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.05), glow('#7fd9c4'));
      stripe2.position.set(x, 2.6, z);
      stripe2.rotation.y = rotY;
      stripe2.translateZ(0.01);
      s.add(stripe2);
    };
    wall(W, cx, minZ, 0);
    wall(W, cx, maxZ, Math.PI);
    wall(D, minX, cz, Math.PI / 2);
    wall(D, maxX, cz, -Math.PI / 2);

    // The posters, each in a thin black frame
    const frameMat = lambert('#1c1b22');
    for (const [file, pw, ph, x, z, rotY] of POSTERS) {
      const ph3 = (POSTER_W * ph) / pw;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(POSTER_W + 0.08, ph3 + 0.08, 0.02), frameMat);
      frame.position.set(x, POSTER_Y, z);
      frame.rotation.y = rotY;
      const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}arcade/posters/${file}.webp`);
      tex.colorSpace = THREE.SRGBColorSpace;
      // unlit, so the room's coloured lights don't muddy the pop colours; a touch dimmed so they don't glow
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W, ph3), new THREE.MeshBasicMaterial({ map: tex, color: '#e2e2e2' }));
      pic.position.set(x, POSTER_Y, z);
      pic.rotation.y = rotY;
      pic.translateZ(0.012);
      s.add(frame, pic);
    }

    // The neon name over the back row.
    const sign = canvasTexture(128, 24, (g) => {
      g.clearRect(0, 0, 128, 24);
      paintDuck(g, 2, 5, 2);
      centredText(g, 'DUCK ARCADE', 72, 8, '#ffd23f');
    });
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1), new THREE.MeshBasicMaterial({ map: sign, transparent: true }));
    neon.position.set(0, 3.2, minZ + 0.02);
    s.add(neon);

    // The front doors (the way you came in): glass full of daylight, California beyond.
    const doors = canvasTexture(32, 32, (g) => {
      g.fillStyle = '#a9d8cc';
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#d8efe6';
      g.fillRect(2, 2, 3, 26);
      g.fillStyle = '#5f5c78';
      g.fillRect(0, 24, 32, 8);
      g.fillStyle = '#1c1b22';
      g.fillRect(15, 0, 2, 32);
      g.fillRect(0, 0, 32, 1);
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: doors }));
    door.position.set(0, 1.2, maxZ - 0.02);
    door.rotation.y = Math.PI;
    s.add(door);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.3), lambert('#ffd23f'));
    canopy.position.set(0, 2.5, maxZ - 0.15);
    s.add(canopy);

    // The giant rubber duck on a plinth in the middle of the room.
    const yellow = lambert('#ffd23f');
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.5, 10), lambert('#ff7eb6'));
    plinth.position.y = 0.25;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), yellow);
    body.scale.set(1.25, 0.8, 0.95);
    body.position.y = 1.05;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), yellow);
    tail.rotation.z = Math.PI / 2.6;
    tail.position.set(-0.95, 1.35, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), yellow);
    head.position.set(0.55, 1.85, 0);
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.35), lambert('#f47b20'));
    bill.position.set(1.0, 1.8, 0);
    const eyeMat = lambert('#1c1b22');
    const eyes = [-0.2, 0.2].map((z) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeMat);
      e.position.set(0.85, 1.97, z);
      return e;
    });
    this.duck.add(plinth, body, tail, head, bill, ...eyes);
    // by the doors, greeting you, out of the way of the aisle
    this.duck.position.set(-4.2, 0, 2.6);
    this.duck.rotation.y = -0.6;
    s.add(this.duck);
  }

  private buildCabinet(game: ArcadeGame, [x, z, yaw]: [number, number, number]) {
    const c = game.colors;
    const g = new THREE.Group();
    const body = lambert(c.body);
    const dark = lambert('#1c1b22');
    const trim = glow(c.trim);

    // the cabinet: a tall box with a stepped front, side stripes, a coin door
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.95, 0.85), body);
    cab.position.y = 0.975;
    g.add(cab);
    for (const sx of [-0.505, 0.505]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.2, 0.12), trim);
      stripe.position.set(sx, 1.2, 0.2);
      stripe.rotation.x = -0.4;
      g.add(stripe);
    }
    // front art (a picture from the game, framed in the trim colour) pushes the coin door down
    if (game.front) {
      // kept below the control panel's overhang, which hides the top from standing height
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.67, 0.01), trim);
      frame.position.set(0, 0.55, 0.43);
      const art = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${game.front}`);
      art.colorSpace = THREE.SRGBColorSpace;
      art.magFilter = art.minFilter = THREE.NearestFilter;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.61), new THREE.MeshLambertMaterial({ map: art }));
      pic.position.set(0, 0.55, 0.437);
      g.add(frame, pic);
    }
    const [coinY, coinH] = game.front ? [0.12, 0.16] : [0.45, 0.4];
    const coin = new THREE.Mesh(new THREE.BoxGeometry(0.34, coinH, 0.02), dark);
    coin.position.set(0, coinY, 0.43);
    g.add(coin);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.02), glow('#e4202c'));
    slot.position.set(0, coinY + coinH / 2 - 0.08, 0.445);
    g.add(slot);

    // control panel with a joystick and two buttons
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.42), dark);
    panel.position.set(0, 1.02, 0.55);
    panel.rotation.x = 0.25;
    g.add(panel);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), lambert('#d8d3cc'));
    stick.position.set(-0.2, 1.14, 0.56);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), lambert('#e4202c'));
    knob.position.set(-0.2, 1.23, 0.56);
    g.add(stick, knob);
    for (const [bx, color] of [[0.12, c.trim], [0.28, '#ff7eb6']] as const) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), glow(color));
      b.position.set(bx, 1.1, 0.6);
      b.rotation.x = 0.25;
      g.add(b);
    }

    // the screen: a lit canvas, tilted back, redrawn to blink its attract message
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    const screen = new THREE.CanvasTexture(canvas);
    screen.colorSpace = THREE.SRGBColorSpace;
    screen.magFilter = screen.minFilter = THREE.NearestFilter;
    const paint = (blink: boolean, t: number) => {
      ctx.fillStyle = '#10131f';
      ctx.fillRect(0, 0, 96, 72);
      ctx.fillStyle = c.screen;
      ctx.fillRect(0, 50, 96, 22);
      // a duck paddling back and forth across the water line
      const dx = Math.round(40 + Math.sin(t * 1.3) * 30);
      paintDuck(ctx, dx, 36, 2);
      centredText(ctx, game.title, 48, 8, c.trim);
      if (cabinet.playing) {
        paintPlaying(ctx, c, t);
      } else if (blink) centredText(ctx, game.ready ? 'PRESS A' : 'SOON', 48, 22, '#ffffff');
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < 72; y += 2) ctx.fillRect(0, y, 96, 1); // scanlines
      screen.needsUpdate = true;
    };
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.7, 0.04), dark);
    bezel.position.set(0, 1.45, 0.45);
    bezel.rotation.x = -0.18;
    g.add(bezel);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.57), new THREE.MeshBasicMaterial({ map: screen }));
    face.position.set(0, 1.45, 0.475);
    face.rotation.x = -0.18;
    g.add(face);

    // the lit marquee on top
    const marquee = canvasTexture(96, 24, (m) => {
      m.fillStyle = '#1c1b22';
      m.fillRect(0, 0, 96, 24);
      m.fillStyle = c.trim;
      for (let i = 0; i < 96; i += 4) {
        m.fillRect(i, 0, 2, 2);
        m.fillRect(i + 2, 22, 2, 2);
      }
      centredText(m, game.title, 48, 8, '#ffffff');
    });
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.3, 0.3),
      [body, body, body, body, new THREE.MeshBasicMaterial({ map: marquee }), body],
    );
    top.position.set(0, 2.1, 0.28);
    g.add(top);

    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    this.scene.add(g);
    const cabinet: Cabinet = {
      game,
      x,
      z,
      normal: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      screen,
      paint,
      playing: false,
    };
    this.cabinets.push(cabinet);
    paint(true, 0);
  }

  /** Stand in front of cabinet `i`, facing it (for picking a game from the menu). */
  faceCabinet(i: number) {
    const c = this.cabinets[i];
    if (!c) return;
    this.pos.x = c.x + c.normal.x * 1.7;
    this.pos.z = c.z + c.normal.z * 1.7;
    this.yaw = Math.atan2(-c.normal.x, c.normal.z);
  }

  /** The bear is right there beside you (as a game closes), facing you, holding up its licorice. */
  bearAppear() {
    const you = { x: this.pos.x, z: this.pos.z };
    this.cabinets.forEach((c) => (c.playing = false));
    const at = besideYou(you, this.yaw, ROOM, this.obstacles(true));
    this.bear.place(at);
    this.bear.face(yawTo(at, you));
    this.bear.offer(true);
    // you're already looking at it when the game's screen goes
    this.yaw = lookYaw(you, at);
    this.pitch = -0.1;
    this.watchBear = 'talk';
  }

  /** You took a licorice. */
  bearGive() {
    this.bear.give();
  }

  /** Off it goes to play Avocado Drop (from wherever it is; nothing if it's not in yet). */
  bearGoPlay() {
    this.watchBear = false;
    const c = this.cabinets.find((k) => k.game.id === BEAR_GAME);
    if (!this.bear.shown || !c) return;
    this.watchBear = 'follow';
    const stand = { x: c.x + c.normal.x * 1.0, z: c.z + c.normal.z * 1.0 };
    this.bear.walk(route(this.bear.pos, stand, this.obstacles(true), AISLES), () => {
      this.bear.face(yawTo(stand, c));
      this.bear.play();
      c.playing = true;
      if (this.watchBear === 'follow') this.watchBear = false;
    });
  }

  /** Where the licorice is on screen (client px) while it's held out, else null: for tests. */
  bagOnScreen(): { x: number; y: number } | null {
    if (!this.bear.offering) return null;
    const p = this.bear.bagTarget.getWorldPosition(new THREE.Vector3()).project(this.camera);
    if (p.z > 1) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** what the bear walks round: cabinets, the big duck, and (if `you`) you */
  private obstacles(you: boolean): Obstacle[] {
    const list: Obstacle[] = this.cabinets.map((c) => ({ x: c.x, z: c.z, r: 0.55 }));
    list.push({ x: this.duck.position.x, z: this.duck.position.z, r: 1.15 });
    if (you) list.push({ x: this.pos.x, z: this.pos.z, r: 0.35 });
    return list;
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = { x: e.clientX, y: e.clientY };
    this.downAt = { x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  /** is the screen point over the bear's licorice? */
  private overBag(clientX: number, clientY: number) {
    if (!this.bear.offering) return false;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObject(this.bear.bagTarget, true).length > 0;
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) {
      if (e.target === this.renderer.domElement) this.renderer.domElement.style.cursor = this.overBag(e.clientX, e.clientY) ? 'pointer' : '';
      return;
    }
    // in the middle of offering, looking around is the bear's job
    if (this.watchBear) return;
    this.yaw += (e.clientX - this.dragging.x) * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - this.dragging.y) * 0.004, -0.8, 0.8);
    this.dragging = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    this.dragging = null;
    const d = this.downAt;
    this.downAt = null;
    // a click (not a drag) on the bag takes a licorice
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && this.overBag(e.clientX, e.clientY)) this.events.onLicorice?.();
  };

  private blocked(x: number, z: number) {
    if (Math.hypot(x - this.duck.position.x, z - this.duck.position.z) < 1.4) return true;
    if (this.bear.shown && Math.hypot(x - this.bear.pos.x, z - this.bear.pos.z) < 0.7) return true;
    return this.cabinets.some((c) => Math.hypot(c.x - x, c.z - z) < 0.95);
  }

  private update(dt: number) {
    this.bear.update(dt, this.last / 1000);
    // walking or turning yourself: stop following it off
    if (this.watchBear === 'follow' && !this.paused && (this.move.forward || this.move.turn)) this.watchBear = false;
    if (this.watchBear && this.bear.shown) {
      // turn to watch it, looking a touch down at the bag while it talks
      const k = 1 - Math.exp(-dt * 3);
      this.yaw = easeAngle(this.yaw, lookYaw(this.pos, this.bear.pos), k);
      this.pitch += ((this.watchBear === 'talk' ? -0.1 : -0.03) - this.pitch) * k;
    }
    if (this.paused) return;
    this.yaw += this.move.turn * TURN * dt;
    const speed = (this.move.run ? RUN : WALK) * dt * this.move.forward;
    const nx = THREE.MathUtils.clamp(this.pos.x + Math.sin(this.yaw) * speed, ROOM.minX + MARGIN, ROOM.maxX - MARGIN);
    const nz = THREE.MathUtils.clamp(this.pos.z - Math.cos(this.yaw) * speed, ROOM.minZ + MARGIN, ROOM.maxZ - MARGIN);
    // slide along whatever's in the way
    if (!this.blocked(nx, this.pos.z)) this.pos.x = nx;
    if (!this.blocked(this.pos.x, nz)) this.pos.z = nz;

    // Which cabinet are you at? Close, in front of its screen, and looking at it.
    const look = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let near: number | null = null;
    let best = PLAY_DIST;
    this.cabinets.forEach((c, i) => {
      const to = new THREE.Vector3(c.x - this.pos.x, 0, c.z - this.pos.z);
      const d = to.length();
      if (d > best) return;
      to.normalize();
      if (-to.dot(c.normal) > 0.3 && to.dot(look) > 0.5) {
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
    // screens: redraw ~6 times a second (the paddling duck), blink twice a second
    const tick = Math.floor(t / 160);
    if (tick !== this.lastBlink) {
      this.lastBlink = tick;
      const blink = Math.floor(t / 500) % 2 === 0;
      this.cabinets.forEach((c) => c.paint(blink, t / 1000));
    }
    this.duck.rotation.y = -0.6 + Math.sin(t / 1800) * 0.4;
    const bob = this.move.forward && !this.paused ? Math.sin(t / 140) * 0.025 : 0;
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
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
