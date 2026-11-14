import { createWorld } from '../city';
import { RACE_FINISH, RACE_START, RACE_STREET, raceAnimals } from '../content/bikeRace';
import { buildCourse, courseAt, lineUp, placeOf, progressOf, ride, RACE_SPEED, type Racer } from './bikeRace';
import { ANIMAL_BIKE_GRIDS } from './sprites';

const world = createWorld();
const start = world.project(RACE_START.lat, RACE_START.lon);
const finish = world.project(RACE_FINISH.lat, RACE_FINISH.lon);
const course = buildCourse(world, start, finish, RACE_STREET)!;
let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('the Admiral-to-Alaska bike race', () => {
  it('runs down California Ave from Admiral to Alaska', () => {
    expect(course).not.toBeNull();
    expect(world.streetAt(course.line[0]!.x, course.line[0]!.y)).toMatch(/California|Admiral/);
    expect(world.streetAt(course.line.at(-1)!.x, course.line.at(-1)!.y)).toMatch(/California|Alaska/);
    // about two kilometres of it
    expect(course.length * 12).toBeGreaterThan(1800);
    expect(course.length * 12).toBeLessThan(2600);
  });

  it('stays on the street the whole way, in every lane the riders use', () => {
    const field = lineUp(raceAnimals.length, rand);
    for (let d = 0; d <= course.length; d += 2) {
      for (const r of field) {
        const p = courseAt(course, d, r.lane);
        expect(world.isWalkable(p.x, p.y)).toBe(true);
      }
    }
  });

  it('knows how far along you are, and when you have left the course', () => {
    const p = courseAt(course, 60);
    expect(progressOf(course, p).d).toBeCloseTo(60, 0);
    expect(progressOf(course, p).off).toBeLessThan(0.5);
    expect(progressOf(course, { x: p.x + 20, y: p.y }).off).toBeGreaterThan(10);
  });

  it('riders go at about your speed, finish in order, and you get your place', () => {
    const field = lineUp(7, rand);
    for (const r of field) {
      expect(r.base).toBeGreaterThan(RACE_SPEED * 0.8);
      expect(r.base).toBeLessThan(RACE_SPEED * 1.05);
    }
    let t = 0;
    while (field.some((r) => r.finished === null) && t < 60) {
      for (const r of field) ride(r, 0.05, t, course);
      t += 0.05;
    }
    expect(field.every((r) => r.finished !== null)).toBe(true);
    // a rabbit finishing after everyone is last; before everyone, first
    const latest = Math.max(...field.map((r) => r.finished!));
    const earliest = Math.min(...field.map((r) => r.finished!));
    expect(placeOf({ d: course.length, finished: latest + 1 }, field)).toBe(8);
    expect(placeOf({ d: course.length, finished: earliest - 1 }, field)).toBe(1);
  });

  it('ranks you by distance while it is still on', () => {
    const field: Racer[] = [10, 30, 50].map((d) => ({ d, base: 14, lane: 0, phase: 0, finished: null }));
    expect(placeOf({ d: 40, finished: null }, field)).toBe(2);
    expect(placeOf({ d: 60, finished: null }, field)).toBe(1);
  });
});

describe('animals on bikes', () => {
  it.each(Object.entries(ANIMAL_BIKE_GRIDS))('%s is 16×20, two pedalling frames', (_, frames) => {
    expect(frames).toHaveLength(2);
    for (const g of frames) {
      expect(g).toHaveLength(20);
      for (const row of g) expect(row).toHaveLength(16);
    }
  });
});
