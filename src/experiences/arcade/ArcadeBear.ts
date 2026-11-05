import * as THREE from 'three';
import { along, BEAR_SPEED, pathLength, type Spot } from '../../game/arcadeBear';

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const BROWN = '#8a5a3b';
const TAN = '#e0b98c';
const INK = '#1c1b22';
const LICORICE = '#d4243a';

/** arm angles about x: 0 hangs down, −π/2 points straight ahead */
const ARM_DOWN = 0.12;
const ARM_OFFER = -2.0;
const ARM_PLAY = -1.25;

type Mode = 'walk' | 'stand' | 'offer' | 'play';

/**
 * The arcade's bear, low-poly like the big rubber duck: brown, tan muzzle and belly, round
 * ears. It walks a path (legs and arms swinging), stands and talks, holds a paper bag of red
 * licorice up in its right paw, and plays a cabinet (paws on the buttons, head bobbing).
 * Where it walks is worked out in game/arcadeBear.ts; ArcadeScene drives it.
 */
export class ArcadeBear {
  readonly group = new THREE.Group();
  /** the bag and a generous invisible box round it: what a click on the licorice hits */
  readonly bagTarget = new THREE.Group();
  pos: Spot = { x: 0, z: 0 };
  private yaw = 0;
  private mode: Mode = 'stand';
  private path: Spot[] = [];
  private walked = 0;
  private arrive: (() => void) | null = null;
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private head = new THREE.Group();
  private body = new THREE.Group();
  private bag = new THREE.Group();
  private sticks: THREE.Mesh[] = [];
  private armAngle = [ARM_DOWN, ARM_DOWN];

  constructor() {
    const brown = lambert(BROWN);
    const tan = lambert(TAN);
    const ink = lambert(INK);
    const ball = (r: number, mat: THREE.Material, x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat);
      m.position.set(x, y, z);
      m.scale.set(...s);
      return m;
    };

    // legs from the hips, each a short stump with a tan foot pad
    for (const x of [-0.17, 0.17]) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.55, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 3, 8), brown);
      leg.position.y = -0.3;
      const foot = ball(0.13, tan, 0, -0.5, 0.08, [1, 0.5, 1.3]);
      hip.add(leg, foot);
      this.legs.push(hip);
      this.group.add(hip);
    }

    // round body with a tan belly
    this.body.add(ball(0.42, brown, 0, 0.98, 0, [1, 1.2, 0.9]), ball(0.3, tan, 0, 0.93, 0.26, [1, 1.15, 0.5]));
    this.group.add(this.body);

    // head: ears, eyes, a tan muzzle and a black nose
    this.head.position.y = 1.58;
    this.head.add(
      ball(0.3, brown, 0, 0, 0),
      ball(0.1, brown, -0.21, 0.24, -0.02),
      ball(0.1, brown, 0.21, 0.24, -0.02),
      ball(0.055, tan, -0.21, 0.24, 0.05),
      ball(0.055, tan, 0.21, 0.24, 0.05),
      ball(0.14, tan, 0, -0.06, 0.25, [1, 0.75, 0.9]),
      ball(0.05, ink, 0, -0.01, 0.37),
      ball(0.035, ink, -0.1, 0.08, 0.26),
      ball(0.035, ink, 0.1, 0.08, 0.26),
    );
    this.group.add(this.head);

    // arms from the shoulders, paws at the ends
    for (const x of [-0.42, 0.42]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(x, 1.28, 0.02);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 3, 8), brown);
      arm.position.y = -0.27;
      shoulder.add(arm, ball(0.11, tan, 0, -0.5, 0.02));
      this.arms.push(shoulder);
      this.group.add(shoulder);
    }

    // the licorice: a paper bag with red twists poking out, in the right paw
    const paper = document.createElement('canvas');
    paper.width = 16;
    paper.height = 20;
    const g = paper.getContext('2d')!;
    g.fillStyle = '#f3e6cc';
    g.fillRect(0, 0, 16, 20);
    g.fillStyle = LICORICE;
    for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 2, 20);
    g.fillStyle = '#f3e6cc';
    g.fillRect(3, 7, 10, 6);
    g.fillStyle = LICORICE;
    g.fillRect(5, 9, 6, 2); // a little licorice on the label
    const tex = new THREE.CanvasTexture(paper);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), new THREE.MeshLambertMaterial({ map: tex }));
    bagMesh.position.y = 0.04;
    this.bag.add(bagMesh);
    const red = lambert(LICORICE);
    for (const [x, tilt] of [[-0.045, 0.25], [0, -0.05], [0.045, -0.3]] as const) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), red);
      stick.position.set(x, 0.17, 0);
      stick.rotation.z = tilt;
      this.sticks.push(stick);
      this.bag.add(stick);
    }
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.65, 0.4),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.y = 0.12;
    this.bagTarget.add(hit);
    this.bag.add(this.bagTarget);
    this.bag.position.set(0, -0.62, 0.02);
    this.bag.visible = false;
    this.arms[1]!.add(this.bag);

    this.group.visible = false;
  }

  get shown() {
    return this.group.visible;
  }
  /** holding the bag up, waiting for you to take one */
  get offering() {
    return this.mode === 'offer' && this.bag.visible;
  }

  /** Appear at a spot. */
  place(at: Spot) {
    this.pos = { ...at };
    this.group.visible = true;
  }

  /** Walk a path (starting where it stands); `onArrive` when it gets there. */
  walk(path: Spot[], onArrive?: () => void) {
    this.path = path;
    this.walked = 0;
    this.arrive = onArrive ?? null;
    this.mode = 'walk';
    this.bag.visible = false;
  }

  face(yaw: number) {
    this.yaw = yaw;
  }

  /** Hold the bag of licorice up (or put it away). */
  offer(on: boolean) {
    this.mode = on ? 'offer' : 'stand';
    this.bag.visible = on;
    if (on) this.sticks.forEach((s) => (s.visible = true));
  }

  /** You took one: a twist leaves the bag, then the bag goes away. */
  give() {
    const left = this.sticks.filter((s) => s.visible);
    if (left[1]) left[1].visible = false;
    setTimeout(() => this.offer(false), 500);
  }

  /** Paws on the buttons. */
  play() {
    this.mode = 'play';
    this.bag.visible = false;
  }

  update(dt: number, t: number) {
    let swing = 0;
    if (this.mode === 'walk') {
      this.walked += BEAR_SPEED * dt;
      const at = along(this.path, this.walked);
      this.pos = at.pos;
      this.yaw = at.yaw;
      swing = Math.sin(this.walked * 5.5);
      if (at.done || this.walked >= pathLength(this.path)) {
        this.mode = 'stand';
        const done = this.arrive;
        this.arrive = null;
        done?.();
      }
    }
    const walking = this.mode === 'walk';
    this.legs[0]!.rotation.x = swing * 0.55;
    this.legs[1]!.rotation.x = -swing * 0.55;

    // arms: swinging as it walks, the bag held up, or mashing the buttons
    const target = [ARM_DOWN, ARM_DOWN];
    if (walking) [target[0], target[1]] = [-swing * 0.4 + ARM_DOWN, swing * 0.4 + ARM_DOWN];
    else if (this.mode === 'offer') target[1] = ARM_OFFER + Math.sin(t * 3) * 0.05;
    else if (this.mode === 'play') {
      const mash = Math.sin(t * 17) > 0.3 ? 0.08 : 0;
      target[0] = ARM_PLAY + mash;
      target[1] = ARM_PLAY + (Math.sin(t * 13 + 1) > 0.3 ? 0.08 : 0);
    }
    const k = walking ? 1 : 1 - Math.exp(-dt * 8);
    this.arms.forEach((arm, i) => {
      this.armAngle[i]! += (target[i]! - this.armAngle[i]!) * k;
      arm.rotation.x = this.armAngle[i]!;
      // a little out from the body; in toward the buttons when playing
      arm.rotation.z = (i ? 1 : -1) * (this.mode === 'play' ? -0.25 : 0.12);
    });
    // the bag stays upright whatever the arm is doing
    this.bag.rotation.x = -this.armAngle[1]!;

    // a bob as it walks, a nod as it plays, a breath when it stands
    const bob = walking ? Math.abs(Math.sin(this.walked * 5.5)) * 0.04 : 0;
    this.body.position.y = bob;
    this.head.position.y = 1.58 + bob + (this.mode === 'play' ? Math.sin(t * 6) * 0.025 : Math.sin(t * 2) * 0.008);
    this.head.rotation.x = this.mode === 'play' ? 0.15 : this.mode === 'offer' ? -0.08 : 0;
    this.head.rotation.z = this.mode === 'offer' ? Math.sin(t * 1.6) * 0.08 : 0;

    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.yaw;
  }
}

/** The bear's face for the dialog box, 16×16. */
const FACE = [
  '..kkk......kkk..',
  '.kbbbk....kbbbk.',
  '.kblbkkkkkkblbk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbbbbbbbbbbbk.',
  '.kbbkbbbbbbkbbk.',
  '.kbbkbbbbbbkbbk.',
  '.kbbbbllllbbbbk.',
  '.kbbbllkkllbbbk.',
  '.kbbbllkkllbbbk.',
  '.kbbbllllllbbbk.',
  '..kbbllkkllbbk..',
  '..kbbbllllbbbk..',
  '...kbbbbbbbbk...',
  '....kkkkkkkk....',
  '................',
];
export const BEAR_FACE = FACE;

let portrait: string | null = null;
export function bearPortrait(): string {
  if (portrait) return portrait;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  const colors: Record<string, string> = { k: INK, b: BROWN, l: TAN };
  FACE.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!colors[ch]) return;
      g.fillStyle = colors[ch];
      g.fillRect(x, y, 1, 1);
    }),
  );
  return (portrait = c.toDataURL());
}
