/**
 * The boxing ring and its two giant chickens, in three.js (loaded only near the stadium:
 * plugins/chickenBoxing.ts imports this lazily). Low-poly and flat-shaded like the arcade's
 * bear, rendered at the map's own pixel size from the map's 3/4 view (south, looking down),
 * so they sit on the pixel grid. Units are tiles; the ring is 5 tiles a side, the chickens
 * about 5 tiles tall — giants next to a one-tile rabbit.
 */
import * as THREE from 'three';
import type { Boxer } from '../content/chickenBoxing';
import type { Pose } from './chickenBoxing';

/** the render, in map pixels (16 a tile) */
export const VIEW_W = 224;
export const VIEW_H = 232;
const TILE_PX = 16;
/** the camera's angle down from level */
const ELEVATION = (52 * Math.PI) / 180;
export const RING = 5;
const DECK = 0.4;

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const INK = '#1c1b22';
const BEAK = '#f2a516';
const COMB = '#d8262e';

const ball = (r: number, mat: THREE.Material, x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1]) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), mat);
  m.position.set(x, y, z);
  m.scale.set(...s);
  return m;
};

/** one giant chicken, facing +x in its own frame; posed each frame from a `Pose` */
class BoxingChicken {
  readonly root = new THREE.Group();
  /** how giant: the model is built about 3 tiles tall */
  static SIZE = 1.5;
  private body = new THREE.Group();
  private head = new THREE.Group();
  private arms: { shoulder: THREE.Group; glove: THREE.Mesh }[] = [];

  constructor(b: Boxer) {
    const feathers = lambert(b.body);
    const yellow = lambert(BEAK);
    const red = lambert(COMB);
    const ink = lambert(INK);
    const gloves = lambert(b.gloves);
    const trunks = lambert(b.trunks);
    // legs and feet
    for (const z of [-0.28, 0.28]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 6), yellow);
      leg.position.set(0, 0.37, z);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.22), yellow);
      foot.position.set(0.1, 0.03, z);
      this.root.add(leg, foot);
    }
    // the body: an egg leaning forward, trunks round its bottom, a fan of tail feathers
    this.body.position.y = 0.7;
    this.body.add(ball(0.85, feathers, 0, 0.75, 0, [1.05, 1.0, 0.85]));
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.7, 0.42, 10), trunks);
    shorts.position.y = 0.32;
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 10), lambert('#fff1e0'));
    belt.position.y = 0.55;
    this.body.add(shorts, belt);
    for (const [a, z] of [[0.5, -0.2], [0.8, 0], [0.5, 0.2]] as const) {
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 5), feathers);
      tail.position.set(-0.8, 1.25, z);
      tail.rotation.z = a;
      this.body.add(tail);
    }
    // head and neck: comb, beak, wattle, eyes
    this.head.position.set(0.35, 1.75, 0);
    this.head.add(ball(0.48, feathers, 0, 0, 0, [1, 1.05, 0.9]));
    for (const [x, y, r] of [[-0.18, 0.45, 0.13], [0.0, 0.52, 0.15], [0.18, 0.45, 0.13]] as const) this.head.add(ball(r, red, x, y, 0, [1, 1.2, 0.6]));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 6), yellow);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.55, -0.02, 0);
    this.head.add(beak, ball(0.11, red, 0.42, -0.25, 0, [0.8, 1.4, 0.7]));
    for (const z of [-0.3, 0.3]) this.head.add(ball(0.065, ink, 0.28, 0.12, z));
    this.body.add(this.head);
    // wings for arms, a boxing glove on each
    for (const z of [0.68, -0.68]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.15, 1.05, z);
      shoulder.add(ball(0.3, feathers, 0.3, 0, 0, [1.4, 0.55, 0.45]));
      const glove = ball(0.27, gloves, 0.75, 0, 0, [1.15, 1, 1]);
      shoulder.add(glove);
      this.arms.push({ shoulder, glove });
      this.body.add(shoulder);
    }
    this.root.add(this.body);
    this.root.scale.setScalar(BoxingChicken.SIZE);
  }

  pose(p: Pose, t: number, side: 1 | -1) {
    const bounce = p.down ? 0 : Math.abs(Math.sin(t * 6 + (side > 0 ? 0 : 1.3))) * 0.08;
    this.body.position.y = 0.7 + bounce;
    // rocked back by a punch, or flat on its back
    this.root.rotation.z = p.hit * 0.32 + p.down * 1.45;
    this.body.position.x = -p.hit * 0.25;
    this.head.rotation.z = p.hit * 0.4 + Math.sin(t * 3) * 0.05;
    this.arms.forEach((a, i) => {
      const ext = p.punch && p.punch.arm === i ? Math.sin(p.punch.k * Math.PI) : 0;
      if (p.cheer) {
        a.shoulder.rotation.set(0, 0, 2.0 + Math.sin(t * 9 + i) * 0.25);
        a.glove.position.x = 0.75;
      } else if (p.down) {
        a.shoulder.rotation.set(0, 0, -0.3);
        a.glove.position.x = 0.7;
      } else if (p.punch?.kind === 'hook' && p.punch.arm === i) {
        // swung round from the side
        a.shoulder.rotation.set(0, (i === 0 ? 1 : -1) * (1 - ext) * 1.1, 0.35);
        a.glove.position.x = 0.75 + ext * 0.45;
      } else {
        // guard up by the beak; a jab straightens it out
        a.shoulder.rotation.set(0, (i === 0 ? -1 : 1) * 0.35 * (1 - ext), 0.75 - ext * 0.6);
        a.glove.position.x = 0.75 + ext * 0.8;
      }
    });
  }

  /** where the head is, in the scene */
  headWorld(out: THREE.Vector3) {
    return this.head.getWorldPosition(out);
  }
}

export class BoxingScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private chickens: [BoxingChicken, BoxingChicken];
  private v = new THREE.Vector3();
  /** where the ring's middle (on the ground) lands in the canvas */
  readonly anchor: { x: number; y: number };

  constructor(boxers: [Boxer, Boxer]) {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(VIEW_W, VIEW_H, false);
    this.renderer.setClearColor(0x000000, 0);
    const hw = VIEW_W / TILE_PX / 2, hh = VIEW_H / TILE_PX / 2;
    this.camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
    const look = new THREE.Vector3(0, 2.6, 0);
    this.camera.position.set(0, look.y + Math.sin(ELEVATION) * 30, Math.cos(ELEVATION) * 30);
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a3a, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-3, 8, 5);
    this.scene.add(sun);
    this.buildRing();
    this.chickens = [new BoxingChicken(boxers[0]), new BoxingChicken(boxers[1])];
    this.chickens[1].root.rotation.y = Math.PI;
    for (const c of this.chickens) this.scene.add(c.root);
    const p = new THREE.Vector3(0, 0, 0).project(this.camera);
    this.anchor = { x: ((p.x + 1) / 2) * VIEW_W, y: ((1 - p.y) / 2) * VIEW_H };
  }

  private buildRing() {
    const s = RING / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(RING, DECK, RING), [
      lambert('#2b3f8a'), lambert('#2b3f8a'), lambert('#e9e2d0'), lambert('#2b3f8a'), lambert('#2b3f8a'), lambert('#2b3f8a'),
    ]);
    deck.position.y = DECK / 2;
    this.scene.add(deck);
    const posts: [number, number, string][] = [[-s, -s, '#e8333a'], [s, s, '#2f6fd8'], [-s, s, '#f3efe4'], [s, -s, '#f3efe4']];
    for (const [x, z, c] of posts) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), lambert(c));
      post.position.set(x, DECK + 0.75, z);
      this.scene.add(post);
    }
    const ropeColors = ['#ff2e93', '#f3efe4', '#ff2e93'];
    ropeColors.forEach((c, i) => {
      const y = DECK + 0.4 + i * 0.38;
      const mat = lambert(c);
      for (const [x, z, w, d] of [[0, -s, RING, 0.05], [0, s, RING, 0.05], [-s, 0, 0.05, RING], [s, 0, 0.05, RING]] as const) {
        const rope = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), mat);
        rope.position.set(x, y, z);
        this.scene.add(rope);
      }
    });
  }

  /** Pose both chickens and draw. Their places in the ring shuffle with `step`. */
  render(fighters: [Pose, Pose], t: number, rest: boolean) {
    fighters.forEach((p, i) => {
      const c = this.chickens[i]!;
      const side = i === 0 ? -1 : 1;
      // in their corners between rounds; face to face (a beak apart, gloves reaching) in one
      // knocked down, it lands across the middle of the ring, still inside the ropes
      const x = rest ? side * 1.7 : side * (1.5 - p.down * 1.3);
      const z = rest ? side * 1.7 : p.step * (i === 0 ? 1 : -1) * 0.6;
      c.root.position.set(x, DECK, z);
      c.root.rotation.y = (i === 0 ? 0 : Math.PI) + (rest ? (i === 0 ? -0.6 : -0.6) : 0);
      c.pose(p, t, i === 0 ? 1 : -1);
    });
    this.renderer.render(this.scene, this.camera);
  }

  /** where fighter `i`'s head is in the canvas (for feathers flying off a punch) */
  headPx(i: 0 | 1): { x: number; y: number } {
    const p = this.chickens[i].headWorld(this.v).project(this.camera);
    return { x: ((p.x + 1) / 2) * VIEW_W, y: ((1 - p.y) / 2) * VIEW_H };
  }
}
