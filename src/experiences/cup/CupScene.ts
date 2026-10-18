import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CupPainter, TEX_H, TEX_W } from './cupTexture';

/** Render at 1/PIXEL resolution and scale up crisp, to match the pixel map. */
const PIXEL = 3;

// The mug, in metres-ish. It hangs open-end-down from an L-shaped pole, tilted, like the real one.
const CUP = { rTop: 1.45, rBottom: 1.62, h: 3.3, y: 6.4 };
const BRUSH_M = 0.3;

const flat = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function textTexture(text: string, bg: string, fg: string, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.beginPath();
  g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = fg;
  g.font = `italic 700 ${h * 0.34}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // the sign is a cylinder cap turned to face the street; turn the lettering upright
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
  return t;
}

export interface CupSceneEvents {
  /** fired while painting so the UI can react to progress */
  onPaint(coverage: number): void;
}

export class CupScene {
  readonly painter = new CupPainter({
    rx: BRUSH_M * (TEX_W / (2 * Math.PI * ((CUP.rTop + CUP.rBottom) / 2))),
    ry: BRUSH_M * (TEX_H / CUP.h),
  });
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private controls: OrbitControls;
  private texture: THREE.CanvasTexture;
  private body: THREE.Mesh;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private painting = false;
  private raf = 0;
  private lastCoverageAt = 0;
  private disposed = false;
  private orbit = { left: 0, up: 0 };

  constructor(
    private host: HTMLElement,
    private events: CupSceneEvents,
    rabbit: HTMLCanvasElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.className = 'cup-canvas';
    host.appendChild(el);

    this.texture = new THREE.CanvasTexture(this.painter.display);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.buildWorld(rabbit);
    this.body = this.buildCup();

    this.camera.position.set(3, 1.6, 13);
    // Registered before OrbitControls so a drag that starts on the cup can claim the pointer.
    el.addEventListener('pointerdown', this.onDown);
    this.controls = new OrbitControls(this.camera, el);
    this.controls.target.set(0, 4.3, 0);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = Math.PI * 0.53; // eye level-ish, never under the sidewalk
    this.controls.update();

    el.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.loop();
  }

  private buildWorld(rabbit: HTMLCanvasElement) {
    const s = this.scene;
    // Sky: a vertical gradient on the background.
    const sky = document.createElement('canvas');
    sky.width = 2;
    sky.height = 256;
    const g = sky.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#2f6fe4');
    grad.addColorStop(0.65, '#7fb6ff');
    grad.addColorStop(1, '#dcecff');
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    s.background = skyTex;
    s.fog = new THREE.Fog('#cfe3ff', 30, 70);

    s.add(new THREE.HemisphereLight('#ffffff', '#8a8fa8', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e0', 1.8);
    sun.position.set(6, 12, 8);
    s.add(sun);

    // Sidewalk, curb, California Ave.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), flat('#cfcbd8'));
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 9), flat('#6d6a8a'));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 9);
    s.add(road);
    for (let x = -36; x < 40; x += 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.18), flat('#ffd34d'));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, 9);
      s.add(dash);
    }
    const curb = new THREE.Mesh(new THREE.BoxGeometry(80, 0.18, 0.3), flat('#ebe7f2'));
    curb.position.set(0, 0.09, 4.5);
    s.add(curb);

    // Lulu: a little white box of a coffee shop with its round pink sign.
    const shop = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 6), flat('#f4f2ee'));
    walls.position.y = 1.8;
    shop.add(walls);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.35, 6.4), flat('#3b3a4a'));
    roof.position.y = 3.75;
    shop.add(roof);
    const siding = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 0.1), flat('#6a5446'));
    siding.position.set(-2.4, 1.8, 3.02);
    shop.add(siding);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 0.08), flat('#2b3b5c'));
    glass.position.set(1.4, 1.5, 3.04);
    shop.add(glass);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.08), flat('#2b2350'));
    door.position.set(-0.4, 1.05, 3.05);
    shop.add(door);
    const sign = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.12, 20),
      [flat('#f2a7c3'), new THREE.MeshLambertMaterial({ map: textTexture('lulu', '#f6b6cf', '#ffffff') }), flat('#f2a7c3')],
    );
    sign.rotation.x = Math.PI / 2;
    sign.position.set(2.2, 3.1, 3.12);
    shop.add(sign);
    shop.position.set(-1, 0, -5.5);
    s.add(shop);
    shop.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => (m.transparent = true));
      }
    });
    this.shop = shop;

    // The L-shaped pole the mug hangs from.
    const white = flat('#f6f6f8');
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 9.2, 10), white);
    pole.position.set(-3.1, 4.6, 0);
    s.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.28, 0.28), white);
    arm.position.set(-1.55, 9.0, 0);
    s.add(arm);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.18), white);
    brace.position.set(-2.3, 8.1, 0);
    brace.rotation.z = 0.75;
    s.add(brace);
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.0, 0.24), white);
    drop.position.set(0, 8.55, 0);
    s.add(drop);
    const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.3, 10), flat('#b9b6c4'));
    footing.position.set(-3.1, 0.15, 0);
    s.add(footing);

    // Trees and a streetlight, low-poly.
    const tree = (x: number, z: number, h: number) => {
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, h * 0.4, 6), flat('#7a4b2a'));
      trunk.position.y = h * 0.2;
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.32, 0), flat('#3fa34d'));
      top.position.y = h * 0.62;
      t.add(trunk, top);
      t.position.set(x, 0, z);
      s.add(t);
    };
    tree(7, 3.6, 4.5);
    tree(-9, 3.4, 5);
    tree(13, 3.8, 4);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), flat('#4a4a5a'));
    lamp.position.set(9.5, 3, 4);
    s.add(lamp);
    const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.35), flat('#4a4a5a'));
    lampHead.position.set(9.1, 6, 4);
    s.add(lampHead);

    // You, for scale: the rabbit from the map, standing on the sidewalk.
    const rTex = new THREE.CanvasTexture(rabbit);
    rTex.magFilter = THREE.NearestFilter;
    rTex.minFilter = THREE.NearestFilter;
    rTex.colorSpace = THREE.SRGBColorSpace;
    const you = new THREE.Sprite(new THREE.SpriteMaterial({ map: rTex }));
    you.scale.set(1.0, 1.0, 1);
    you.position.set(-1.6, 0.5, 2.6);
    s.add(you);
  }

  private buildCup(): THREE.Mesh {
    const cup = new THREE.Group();
    // thetaStart = π puts texture u = 0.5 on +z (facing the street) and u = 0.75 on +x (handle side).
    const outer = new THREE.CylinderGeometry(CUP.rTop, CUP.rBottom, CUP.h, 40, 1, true, Math.PI);
    const body = new THREE.Mesh(outer, new THREE.MeshLambertMaterial({ map: this.texture }));
    cup.add(body);
    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(CUP.rTop - 0.08, CUP.rBottom - 0.08, CUP.h - 0.05, 40, 1, true),
      flat('#f7f3ee', { side: THREE.BackSide }),
    );
    cup.add(inner);
    const base = new THREE.Mesh(new THREE.CircleGeometry(CUP.rTop, 40), flat('#efeae4'));
    base.rotation.x = -Math.PI / 2;
    base.position.y = CUP.h / 2;
    cup.add(base);
    const insideBase = new THREE.Mesh(new THREE.CircleGeometry(CUP.rTop - 0.08, 40), flat('#fbf8f4'));
    insideBase.rotation.x = Math.PI / 2;
    insideBase.position.y = CUP.h / 2 - 0.06;
    cup.add(insideBase);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(CUP.rBottom - 0.04, 0.06, 6, 40), flat('#f7f3ee'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -CUP.h / 2;
    cup.add(rim);
    // Handle: a fat C off the +x side. The arc runs a bit past a half-circle and its centre sits
    // inside the wall, so both ends sink into the body instead of floating beside it.
    const HANDLE_ARC = Math.PI + 0.7;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.27, 10, 24, HANDLE_ARC), flat('#f4b6cb'));
    handle.rotation.z = -HANDLE_ARC / 2;
    handle.position.set((CUP.rTop + CUP.rBottom) / 2 - 0.2, 0, 0);
    handle.name = 'handle';
    cup.add(handle);
    // Hung from the arm, tipped toward the street.
    cup.position.set(0.15, CUP.y, 0);
    cup.rotation.set(0.22, 0.25, -0.12);
    this.scene.add(cup);
    this.handle = handle;
    return body;
  }

  private handle: THREE.Mesh | null = null;
  private shop: THREE.Group | null = null;
  private shopFade = 1;

  /** Walked around behind Lulu? Ghost the building so it never hides the mug. */
  private fadeShop() {
    if (!this.shop) return;
    const target = this.camera.position.z < -1 ? 0.18 : 1;
    this.shopFade += (target - this.shopFade) * 0.15;
    this.shop.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        m.opacity = this.shopFade;
        m.depthWrite = this.shopFade > 0.9;
      });
    });
  }

  /** The handle isn't textured; keep it the body color of the current coat. */
  setHandleColor(color: string) {
    (this.handle?.material as THREE.MeshLambertMaterial | undefined)?.color.set(color);
  }

  refresh() {
    this.texture.needsUpdate = true;
  }

  /** Orbit with the keyboard: call each frame with -1..1 per axis. */
  setOrbitInput(left: number, up: number) {
    this.orbit = { left, up };
  }

  private hitUv(e: PointerEvent): THREE.Vector2 | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObject(this.body, false)[0];
    return hit?.uv ?? null;
  }

  private onDown = (e: PointerEvent) => {
    const uv = this.hitUv(e);
    if (!uv || !this.painter.hasNext) return;
    // Painting, not orbiting: stop OrbitControls from seeing this drag.
    e.stopImmediatePropagation();
    this.painting = true;
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.paintAt(uv);
  };

  private onMove = (e: PointerEvent) => {
    const uv = this.hitUv(e);
    this.renderer.domElement.style.cursor = uv && this.painter.hasNext ? 'crosshair' : 'grab';
    if (!this.painting) return;
    if (uv) this.paintAt(uv);
    else this.painter.lift();
  };

  private onUp = () => {
    if (!this.painting) return;
    this.painting = false;
    this.controls.enabled = true;
    this.painter.lift();
    this.events.onPaint(this.painter.coverage());
  };

  private paintAt(uv: THREE.Vector2) {
    this.painter.paint(uv.x, uv.y);
    this.refresh();
    const now = performance.now();
    if (now - this.lastCoverageAt > 120) {
      this.lastCoverageAt = now;
      this.events.onPaint(this.painter.coverage());
    }
  }

  private resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(Math.ceil(w / PIXEL), Math.ceil(h / PIXEL), false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (this.disposed) return;
    if (this.orbit.left || this.orbit.up) {
      // Keyboard orbit: rotate the camera around the target.
      const off = this.camera.position.clone().sub(this.controls.target);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta -= this.orbit.left * 0.03;
      sph.phi = THREE.MathUtils.clamp(sph.phi - this.orbit.up * 0.02, this.controls.minPolarAngle, this.controls.maxPolarAngle);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    }
    this.controls.update();
    this.fadeShop();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.renderer.dispose();
    this.texture.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          (m as THREE.MeshLambertMaterial).map?.dispose();
          m.dispose();
        });
      }
    });
    this.renderer.domElement.remove();
  }
}
