import { buildBikeRabbit, type CityGame, type CityPlugin, type DrawContext, type Target, type Vec, type Vehicle } from '../../city';
import { ordinal, RACE_FINISH, RACE_START, RACE_STREET, raceAnimals, raceBanners, raceJoin, type AnimalKind } from '../../content/bikeRace';
import { sounds } from '../../ui/sounds';
import { buildCourse, COUNTDOWN, courseAt, lineUp, OFF_COURSE, placeOf, progressOf, RACE_SPEED, ride, type Course, type Racer } from '../bikeRace';
import { buildAnimalBike } from '../sprites';

type Phase = 'idle' | 'countdown' | 'racing' | 'after';

export interface RaceResult {
  place: number;
  total: number;
  seconds: number;
  /** the winner's name and kind (you, if you won) */
  winner: string;
  winnerKind: AnimalKind | 'rabbit';
}

/** your slot on the grid: the back row, outside lane */
const YOU_LANE = 1.125;
const YOU_START = 0.4;

/** A seeded random, so each race's field differs. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/**
 * The Admiral-to-Alaska bike race (rules in game/bikeRace.ts, words in content/bikeRace.ts):
 * seven animals on bikes wait under the START banner on California at SW Admiral Way. {A}
 * there and you're on the grid on your bike (the city's `vehicle`, so you ride at race speed
 * without Shift); 3-2-1-GO and everyone races south to the FINISH banner at SW Alaska St.
 * Your place and time show at the top; at the line the winner tells you how you did
 * (`onFinish`, the App opens the dialog). Ride off the course and you've left the race. Once
 * you're well away, the animals are back on the start line for the next one.
 */
export class BikeRace implements CityPlugin {
  course: Course | null = null;
  phase: Phase = 'idle';
  racers: Racer[] = [];
  /** race clock, seconds (negative during the countdown) */
  clock = 0;
  you: { d: number; finished: number | null; inRace: boolean } = { d: 0, finished: null, inRace: false };
  /** the App shows the result when you cross the line */
  onFinish: ((r: RaceResult) => void) | null = null;
  private rand = rng(Date.now());
  private sprites: Map<AnimalKind, [HTMLCanvasElement, HTMLCanvasElement]> | null = null;
  private vehicle: Vehicle | null = null;
  private lastBeep = 99;

  attach(game: CityGame) {
    const w = game.world;
    this.course = buildCourse(w, w.project(RACE_START.lat, RACE_START.lon), w.project(RACE_FINISH.lat, RACE_FINISH.lon), RACE_STREET);
    this.racers = lineUp(raceAnimals.length, this.rand);
    this.walkable = (x, y) => w.isWalkable(x, y);
  }

  private spritesFor() {
    return (this.sprites ??= new Map(raceAnimals.map((a) => [a.kind, buildAnimalBike(a.kind, a.jersey)])));
  }

  /** An animal's face for the dialog box. */
  portraitOf(kind: AnimalKind | 'rabbit'): string {
    if (kind === 'rabbit') return buildBikeRabbit().down[0]!.toDataURL();
    return this.spritesFor().get(kind)![0].toDataURL();
  }

  targets(): Target[] {
    if (!this.course || this.phase !== 'idle') return [];
    const p = courseAt(this.course, 0);
    return [{ key: 'race:start', kind: 'race', x: p.x, y: p.y, label: raceJoin }];
  }

  /** {A} at the start line: onto the grid, on your bike, and the countdown starts. */
  join(game: CityGame) {
    const c = this.course;
    if (!c || this.phase !== 'idle') return;
    this.racers = lineUp(raceAnimals.length, this.rand);
    this.phase = 'countdown';
    this.clock = -COUNTDOWN;
    this.lastBeep = 99;
    this.you = { d: YOU_START, finished: null, inRace: true };
    this.vehicle ??= {
      // held on the line until GO, then anywhere on the street
      canGo: (x, y) => this.phase === 'racing' && game.world.isWalkable(x, y),
      speed: RACE_SPEED,
      sprite: buildBikeRabbit(),
      fps: 10,
      riding: true,
    };
    game.vehicle = this.vehicle;
    game.player.pos = courseAt(c, YOU_START, YOU_LANE);
    game.player.facing = 'down';
  }

  /** Out of the race (finished, or rode off): back on your own two feet. */
  private leave(game: CityGame) {
    this.you.inRace = false;
    if (game.vehicle === this.vehicle) game.vehicle = null;
  }

  update(dt: number, game: CityGame) {
    const c = this.course;
    if (!c || this.phase === 'idle') return;
    if (game.paused && this.phase !== 'after') return;
    this.clock += dt;
    if (this.phase === 'countdown') {
      // a beep on each of 3, 2, 1, then GO
      const left = Math.ceil(-this.clock);
      if (left !== this.lastBeep && left >= 1) sounds.raceBeep();
      this.lastBeep = left;
      if (this.clock >= 0) {
        this.phase = 'racing';
        sounds.raceGo();
      }
      return;
    }
    for (const r of this.racers) ride(r, dt, this.clock, c);
    if (this.you.inRace) {
      const { d, off } = progressOf(c, game.player.pos);
      this.you.d = d;
      if (off > OFF_COURSE) this.leave(game);
      else if (d >= c.length - 0.6) {
        this.you.finished = this.clock;
        this.leave(game);
        sounds.raceFinish();
        const place = placeOf(this.you, this.racers);
        const first = [...this.racers].filter((r) => r.finished !== null).sort((a, b) => a.finished! - b.finished!)[0];
        const winner = place === 1 || !first ? null : raceAnimals[this.racers.indexOf(first)]!;
        this.onFinish?.({
          place,
          total: this.racers.length + 1,
          seconds: this.clock,
          winner: winner?.name ?? 'You',
          winnerKind: winner?.kind ?? 'rabbit',
        });
      }
    }
    if (this.phase === 'racing' && this.racers.every((r) => r.finished !== null) && !this.you.inRace) this.phase = 'after';
    // back to the line for the next race, once you're well away from both ends
    if (this.phase === 'after') {
      const p = game.player.pos;
      const far = (q: Vec) => Math.hypot(q.x - p.x, q.y - p.y) > 25;
      if (far(courseAt(c, 0)) && far(courseAt(c, c.length))) {
        this.phase = 'idle';
        this.racers = lineUp(raceAnimals.length, this.rand);
      }
    }
  }

  draw(d: DrawContext) {
    const c = this.course;
    if (!c) return;
    const { ctx, time } = d;
    const sprites = this.spritesFor();
    // the riders
    this.racers.forEach((r, i) => {
      const at = courseAt(c, r.d, r.lane);
      const s = d.toScreen(at);
      if (!d.onScreen(s, 24)) return;
      const moving = this.phase === 'racing' && r.finished === null;
      const frames = sprites.get(raceAnimals[i]!.kind)!;
      const img = frames[moving ? Math.floor(time * 10 + i) % 2 : 0];
      // waiting riders bob a little on their bikes
      const bob = moving ? 0 : Math.round(Math.sin(time * 2 + i) * 0.6);
      d.push({
        y: at.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(s.x - 5, s.y + 1, 10, 2);
          ctx.drawImage(img, s.x - 8, s.y - img.height + 2 + bob);
        },
      });
    });
    // the banners over the road
    this.banner(d, c, 0, raceBanners.start);
    this.banner(d, c, c.length, raceBanners.finish);
    // the countdown and, while you race, your place and time
    if (this.phase === 'countdown' || (this.phase === 'racing' && this.clock < 1)) {
      const n = Math.ceil(-this.clock);
      this.bigText(d, n >= 1 ? String(n) : 'GO!');
    }
    if (this.you.inRace && this.phase === 'racing') {
      const place = placeOf(this.you, this.racers);
      this.hud(d, `${ordinal(place)} / ${this.racers.length + 1}   ${this.clock.toFixed(1)}s`);
    }
  }

  /** A banner across the road at `at` along the course: poles at the kerbs, a checked cloth with its word. */
  private banner(d: DrawContext, c: Course, at: number, word: string) {
    const mid = courseAt(c, at);
    const s = d.toScreen(mid);
    if (!d.onScreen(s, 80)) return;
    // the road's edges here
    let l = 0, r = 0;
    while (l < 6 && this.walkable(mid.x - l - 0.5, mid.y)) l += 0.5;
    while (r < 6 && this.walkable(mid.x + r + 0.5, mid.y)) r += 0.5;
    const x0 = d.toScreen({ x: mid.x - l - 0.3, y: mid.y }).x;
    const x1 = d.toScreen({ x: mid.x + r + 0.3, y: mid.y }).x;
    const { ctx } = d;
    d.push({
      y: Infinity,
      draw: () => {
        const top = s.y - 30;
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(x0 - 1, top, 3, 32);
        ctx.fillRect(x1 - 1, top, 3, 32);
        // the cloth: black and white checks with the word on a band
        for (let x = x0 + 2; x < x1 - 1; x += 4) {
          for (let k = 0; k < 2; k++) {
            ctx.fillStyle = ((x - x0) / 4 + k) % 2 < 1 ? '#f3efe4' : '#2a1a12';
            ctx.fillRect(x, top + 1 + k * 3, Math.min(4, x1 - 1 - x), 3);
          }
        }
        ctx.fillStyle = '#ff2e93';
        ctx.fillRect(x0 + 2, top + 7, x1 - x0 - 3, 10);
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fff1e0';
        ctx.fillText(word, Math.round((x0 + x1) / 2), top + 8);
        ctx.textAlign = 'start';
      },
    });
  }

  /** is (x, y) street? (set at attach) */
  private walkable: (x: number, y: number) => boolean = () => false;

  /** a big word in the middle of the screen (the countdown) */
  private bigText(d: DrawContext, text: string) {
    const { ctx } = d;
    d.push({
      y: Infinity,
      draw: () => {
        ctx.font = '24px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const x = Math.round(d.view.w / 2), y = Math.round(d.view.h / 2) - 40;
        ctx.fillStyle = '#2a1a12';
        ctx.fillText(text, x + 2, y + 2);
        ctx.fillStyle = text === 'GO!' ? '#ff2e93' : '#ffb627';
        ctx.fillText(text, x, y);
        ctx.textAlign = 'start';
      },
    });
  }

  /** your place and time, top middle */
  private hud(d: DrawContext, text: string) {
    const { ctx } = d;
    d.push({
      y: Infinity,
      draw: () => {
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'start'; // other drawings leave it centred
        const w = ctx.measureText(text).width + 12;
        // below the HUD's buttons along the top
        const x = Math.round(d.view.w / 2 - w / 2), y = 26;
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(x - 1, y - 1, w + 2, 16);
        ctx.fillStyle = '#fff1e0';
        ctx.fillRect(x, y, w, 14);
        ctx.fillStyle = '#2a1a12';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x + 6, y + 3);
      },
    });
  }
}
