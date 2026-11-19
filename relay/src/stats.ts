import { DurableObject } from 'cloudflare:workers';

/**
 * Counts, one Durable Object per app (`idFromName(appId)`): how many rabbits came each day and the
 * most at once, and how often each thing on the island was opened (`count(key)`, from the game's
 * `/count` beacon). Only numbers per day are kept. The peer ids it sees (random per page load,
 * never tied to a person) are held for the current day only, to count a rabbit that steps out and
 * back in once, and are deleted when the day turns.
 *
 * Days are Seattle days. A key is `[a-z0-9:_-]`, up to 64 characters, and a day holds at most
 * MAX_KEYS of them, so a script spamming made-up keys can't grow the table.
 */

/** distinct keys one day can hold (the island has well under 200 things to open) */
export const MAX_KEYS = 400;
/** how long counts are kept */
export const KEEP_DAYS = 400;
export const KEY = /^[a-z0-9][a-z0-9:_-]{0,63}$/;
/** the reserved keys a day's visits are kept under */
const VISITS = '@visits';
const PEAK = '@peak';

/** YYYY-MM-DD in Seattle */
export function seattleDay(ms = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
}
const daysAgo = (n: number, ms = Date.now()) => seattleDay(ms - n * 86_400_000);

export type DayStats = { day: string; visits: number; peak: number; opened: Record<string, number> };
export type StatsReply = { generated_at: string; today: string; days: DayStats[] };

export class Stats extends DurableObject {
  private ready = false;

  private sql() {
    const sql = this.ctx.storage.sql;
    if (!this.ready) {
      sql.exec('CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))');
      sql.exec('CREATE TABLE IF NOT EXISTS peers (day TEXT NOT NULL, peer TEXT NOT NULL, PRIMARY KEY (day, peer))');
      this.ready = true;
    }
    return sql;
  }

  /** A rabbit joined a room: a visit if it's new today; `online` (how many are in now) may set the day's peak. */
  visit(peer: string, online: number): void {
    const sql = this.sql();
    const day = seattleDay();
    sql.exec('DELETE FROM peers WHERE day <> ?', day);
    const fresh = sql.exec('INSERT OR IGNORE INTO peers (day, peer) VALUES (?, ?)', day, peer).rowsWritten > 0;
    if (fresh) this.bump(day, VISITS, 1);
    sql.exec(
      'INSERT INTO counts (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = max(n, excluded.n)',
      day,
      PEAK,
      online,
    );
  }

  /** Something was opened. False if the key is bad or the day is full. */
  count(key: string): boolean {
    if (!KEY.test(key)) return false;
    const day = seattleDay();
    const sql = this.sql();
    const have = sql.exec('SELECT 1 FROM counts WHERE day = ? AND key = ?', day, key).toArray().length > 0;
    if (!have) {
      const keys = sql.exec('SELECT count(*) AS k FROM counts WHERE day = ?', day).one().k as number;
      if (keys >= MAX_KEYS) return false;
    }
    this.bump(day, key, 1);
    return true;
  }

  /** The last `days` days, newest first (days with nothing are left out). */
  stats(days = 30): StatsReply {
    const sql = this.sql();
    sql.exec('DELETE FROM counts WHERE day < ?', daysAgo(KEEP_DAYS));
    const from = daysAgo(Math.max(1, Math.min(days, KEEP_DAYS)) - 1);
    const out = new Map<string, DayStats>();
    for (const r of sql.exec('SELECT day, key, n FROM counts WHERE day >= ? ORDER BY day DESC, n DESC', from)) {
      const day = r.day as string;
      let d = out.get(day);
      if (!d) out.set(day, (d = { day, visits: 0, peak: 0, opened: {} }));
      if (r.key === VISITS) d.visits = r.n as number;
      else if (r.key === PEAK) d.peak = r.n as number;
      else d.opened[r.key as string] = r.n as number;
    }
    return { generated_at: new Date().toISOString(), today: seattleDay(), days: [...out.values()] };
  }

  private bump(day: string, key: string, by: number) {
    this.sql().exec('INSERT INTO counts (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n', day, key, by);
  }
}
