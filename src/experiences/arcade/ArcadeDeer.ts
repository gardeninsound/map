import * as THREE from 'three';
import type { Spot } from '../../game/arcadeBear';

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const COAT = '#b07a4a';
const CREAM = '#f1e6d2';
const INK = '#1c1b22';
const ANTLER = '#e3d3b0';

/** foreleg angles about x: 0 hangs down, −π/2 points straight ahead */
const PLAY = -1.3;

/**
 * A deer in the Duck Arcade, low-poly like the bear and the big duck: a cartoon buck standing up
 * at a cabinet, front hooves on the buttons. It plays the whole visit: hooves tapping, head
 * bobbing to the beat, ears twitching, tail flicking, and every so often a little hop when it
 * does well. ArcadeScene stands it at its cabinet (DEER_GAME in content/duckArcade.ts).
 */
export class ArcadeDeer {
  readonly group = new THREE.Group();
  pos: Spot = { x: 0, z: 0 };
  private legs: THREE.Group[] = [];
  private arms: THREE.Group[] = [];
  private head = new THREE.Group();
  private ears: THREE.Mesh[] = [];
  private tail: THREE.Mesh;
  private body = new THREE.Group();

  constructor() {
    const coat = lambert(COAT);
    const cream = lambert(CREAM);
    const ink = lambert(INK);
    const antler = lambert(ANTLER);
    const ball = (r: number, mat: THREE.Material, x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat);
      m.position.set(x, y, z);
      m.scale.set(...s);
      return m;
    };
    const stick = (r: number, len: number, mat: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 6), mat);

    // long thin hind legs, dark hooves
    for (const x of [-0.12, 0.12]) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.66, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.45, 3, 7), coat);
      leg.position.y = -0.32;
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.13), ink);
      hoof.position.set(0, -0.63, 0.02);
      hip.add(leg, hoof);
      this.legs.push(hip);
      this.group.add(hip);
    }

    // a slim body, cream belly, the white tail at the back
    this.body.add(ball(0.28, coat, 0, 1.0, 0, [0.95, 1.35, 0.8]), ball(0.19, cream, 0, 0.95, 0.15, [1, 1.3, 0.45]));
    this.tail = ball(0.07, cream, 0, 0.82, -0.22, [1, 1.4, 0.8]);
    this.body.add(this.tail);
    // the neck, leaning forward to the screen
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.24, 3, 7), coat);
    neck.position.set(0, 1.42, 0.04);
    neck.rotation.x = 0.25;
    this.body.add(neck);
    this.group.add(this.body);

    // the head: long face, cream muzzle, black nose, eyes, big ears, antlers
    this.head.position.set(0, 1.62, 0.07);
    this.head.add(
      ball(0.15, coat, 0, 0, 0, [0.9, 0.95, 1.15]),
      ball(0.085, cream, 0, -0.05, 0.16, [1, 0.85, 1.1]),
      ball(0.035, ink, 0, -0.03, 0.25),
      ball(0.026, ink, -0.08, 0.04, 0.1),
      ball(0.026, ink, 0.08, 0.04, 0.1),
    );
    for (const side of [-1, 1]) {
      const ear = ball(0.06, coat, side * 0.15, 0.08, -0.02, [1.9, 0.75, 0.5]);
      ear.rotation.z = side * 0.35;
      this.ears.push(ear);
      this.head.add(ear);
      // an antler: a beam up and out, two tines off it
      const beam = stick(0.022, 0.28, antler);
      beam.position.set(side * 0.08, 0.24, -0.02);
      beam.rotation.z = -side * 0.45;
      const tine1 = stick(0.016, 0.13, antler);
      tine1.position.set(side * 0.11, 0.26, 0.04);
      tine1.rotation.set(0.6, 0, -side * 0.1);
      const tine2 = stick(0.016, 0.12, antler);
      tine2.position.set(side * 0.17, 0.35, 0.01);
      tine2.rotation.z = side * 0.2;
      this.head.add(beam, tine1, tine2);
    }
    this.group.add(this.head);

    // forelegs from the shoulders, hooves on the buttons
    for (const x of [-0.2, 0.2]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(x, 1.28, 0.05);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 7), coat);
      arm.position.y = -0.22;
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.08), ink);
      hoof.position.y = -0.43;
      shoulder.add(arm, hoof);
      this.arms.push(shoulder);
      this.group.add(shoulder);
    }
  }

  /** Stand at `at`, facing along `yaw` (to its cabinet). */
  place(at: Spot, yaw: number) {
    this.pos = { ...at };
    this.group.position.set(at.x, 0, at.z);
    this.group.rotation.y = yaw;
  }

  update(t: number) {
    // a beat about twice a second, like the busker's songs
    const beat = t * Math.PI * 4;
    // every few seconds a little hop of joy
    const hopPhase = t % 6.5;
    const hop = hopPhase < 0.45 ? Math.sin((hopPhase / 0.45) * Math.PI) * 0.12 : 0;
    this.group.position.y = hop;
    // hooves tapping the buttons, one then the other, on the beat
    this.arms.forEach((arm, i) => {
      arm.rotation.x = PLAY + (Math.sin(beat + i * Math.PI) > 0.4 ? 0.1 : 0) - hop;
      arm.rotation.z = (i ? 1 : -1) * -0.15;
    });
    // knees give a little with the beat; legs tuck on the hop
    this.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(beat + i * Math.PI) * 0.04 + hop * 2));
    // the body sways, the head bobs
    this.body.rotation.z = Math.sin(beat / 2) * 0.04;
    this.head.position.y = 1.62 + Math.abs(Math.sin(beat / 2)) * 0.03;
    this.head.rotation.x = 0.12 + Math.sin(beat) * 0.06;
    this.head.rotation.z = Math.sin(beat / 2) * 0.06;
    // ears twitch now and then; the tail flicks
    const twitch = (t * 0.9) % 3 < 0.15 ? 0.4 : 0;
    this.ears.forEach((ear, i) => (ear.rotation.x = i ? twitch : twitch * 0.5));
    this.tail.position.y = 0.82 + (Math.sin(t * 9) > 0.6 ? 0.04 : 0);
  }
}
