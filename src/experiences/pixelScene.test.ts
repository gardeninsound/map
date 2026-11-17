import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeTree, Glance } from './pixelScene';

describe('Glance (looking round from a ride)', () => {
  it('turns within limits and drifts back when let go', () => {
    const g = new Glance();
    g.turn(-100, 50);
    expect(g.yaw).toBeCloseTo(0.6);
    expect(g.pitch).toBeCloseTo(-0.2);
    g.turn(-10000, -10000);
    expect([g.yaw, g.pitch]).toEqual([2.4, 0.7]);
    g.settle(0.1);
    expect(g.yaw).toBeCloseTo(2.4 * 0.85);
    g.settle(1); // a long frame: straight ahead, not past it
    expect([g.yaw, g.pitch]).toEqual([0, 0]);
  });
});

describe('disposeTree', () => {
  it('frees every geometry, material and texture, in meshes, lines, points and sprites', () => {
    const tex = new THREE.Texture();
    const alpha = new THREE.Texture();
    const meshMat = new THREE.MeshBasicMaterial({ map: tex, alphaMap: alpha });
    const geo = new THREE.BoxGeometry();
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(new THREE.Mesh(geo, [meshMat, new THREE.MeshLambertMaterial()]));
    root.add(inner, new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()), new THREE.Points(), new THREE.Sprite());
    const spies = [tex, alpha, meshMat, geo].map((o) => vi.spyOn(o, 'dispose'));
    expect(() => disposeTree(root)).not.toThrow();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});
