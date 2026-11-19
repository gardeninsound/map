import { useEffect, useMemo, useState } from 'react';
import { arcadeGames } from '../content/duckArcade';
import { locations } from '../content/locations';
import {
  ageLabel,
  checkOf,
  lastDays,
  nameOf,
  otherIssues,
  pullOf,
  spotsTodo,
  totals,
  wishesOf,
  type GhCheckRuns,
  type GhIssue,
  type GhPull,
  type Names,
  type Pull,
  type Stats,
} from './model';

type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: T };
const names: Names = { places: locations, games: arcadeGames };

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status === 403 ? 'GitHub says to slow down; try again in a while' : `HTTP ${r.status}`);
  return (await r.json()) as T;
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]): Load<T> {
  const [s, set] = useState<Load<T>>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && set({ state: 'ok', data }),
      (e: Error) => live && set({ state: 'error', message: e.message }),
    );
    return () => {
      live = false;
    };
  }, deps);
  return s;
}

export function AdminPage({ stats, github }: { stats: string; github: string }) {
  const counts = useLoad(() => json<Stats>(stats), [stats]);
  const now = useMemo(() => Date.now(), []);
  const pulls = useLoad(async () => {
    const open = await json<GhPull[]>(`${github}/pulls?state=open&per_page=30`);
    const checks = await Promise.all(open.map((p) => json<GhCheckRuns>(`${github}/commits/${p.head.sha}/check-runs`).catch(() => null)));
    return open.map((p, i) => pullOf(p, checkOf(checks[i]!), now));
  }, [github]);
  const issues = useLoad(() => json<GhIssue[]>(`${github}/issues?state=open&per_page=100`), [github]);
  const todo = useMemo(() => spotsTodo(locations), []);

  return (
    <div className="story admin">
      <header className="story-head">
        <p className="story-kicker">Garden in Sound · for Mike and Jim</p>
        <h1 className="story-title">The island today</h1>
      </header>

      <section className="admin-card" aria-labelledby="visitors">
        <h2 id="visitors">Visitors</h2>
        {counts.state === 'loading' && <p className="admin-quiet">Counting…</p>}
        {counts.state === 'error' && <p className="admin-quiet">Couldn't read the counts ({counts.message}).</p>}
        {counts.state === 'ok' && <Visitors s={counts.data} />}
      </section>

      <section className="admin-card" aria-labelledby="prs">
        <h2 id="prs">Pull requests</h2>
        {pulls.state === 'loading' && <p className="admin-quiet">Asking GitHub…</p>}
        {pulls.state === 'error' && <p className="admin-quiet">Couldn't read them ({pulls.message}).</p>}
        {pulls.state === 'ok' && (pulls.data.length ? <Pulls list={pulls.data} /> : <p className="admin-quiet">None open. Everything's live.</p>)}
      </section>

      <section className="admin-card" aria-labelledby="open">
        <h2 id="open">Open items</h2>
        <h3>Wishes waiting in the idea box</h3>
        {issues.state === 'loading' && <p className="admin-quiet">Asking GitHub…</p>}
        {issues.state === 'error' && <p className="admin-quiet">Couldn't read them ({issues.message}).</p>}
        {issues.state === 'ok' && <Items list={wishesOf(issues.data, now)} none="No wishes waiting." />}
        <h3>For Mike</h3>
        <ul className="admin-list">
          <li>
            <b>Pins to confirm:</b> {todo.unconfirmed.length ? todo.unconfirmed.join(', ') : 'none'}
          </li>
          <li>
            <b>Spots still "coming soon":</b> {todo.comingSoon.length ? todo.comingSoon.join(', ') : 'none'}
          </li>
        </ul>
        {issues.state === 'ok' && otherIssues(issues.data, now).length > 0 && (
          <>
            <h3>Other open issues</h3>
            <Items list={otherIssues(issues.data, now)} none="" />
          </>
        )}
      </section>

      <footer className="story-foot">
        Counts are anonymous, per day, from the live site (relay/README.md). <a href={import.meta.env.BASE_URL}>Back to the map →</a> ·{' '}
        <a href={`${import.meta.env.BASE_URL}story/`}>the story log</a>
      </footer>
    </div>
  );
}

function Tile({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="admin-tile">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

function Visitors({ s }: { s: Stats }) {
  const [range, setRange] = useState<7 | 30>(7);
  const today = lastDays(s, 1)[0]!;
  const t = useMemo(() => totals(s, range), [s, range]);
  const top = t.opened.slice(0, 12);
  const most = top[0]?.n ?? 1;
  return (
    <>
      <div className="admin-tiles">
        <Tile n={s.now} label="on the island now" />
        <Tile n={today.visits} label="visits today" />
        <Tile n={today.peak} label="most at once today" />
        <Tile n={totals(s, 7).visits} label="visits, last 7 days" />
        <Tile n={totals(s, 30).visits} label="visits, last 30 days" />
      </div>
      <h3>Visits a day, last 30 days</h3>
      <Bars days={lastDays(s, 30)} />
      <div className="admin-range-head">
        <h3>Most opened</h3>
        <div className="admin-range" role="group" aria-label="over">
          {([7, 30] as const).map((n) => (
            <button key={n} className={n === range ? 'on' : ''} aria-pressed={n === range} onClick={() => setRange(n)}>
              {n} days
            </button>
          ))}
        </div>
      </div>
      {top.length === 0 ? (
        <p className="admin-quiet">Nothing opened yet in the last {range} days.</p>
      ) : (
        <table className="admin-top">
          <tbody>
            {top.map((o) => (
              <tr key={o.key}>
                <th scope="row" title={o.key}>
                  {nameOf(o.key, names)}
                </th>
                <td className="admin-bar-cell">
                  <span className="admin-bar" style={{ width: `${(o.n / most) * 100}%` }} />
                </td>
                <td className="admin-n">{o.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** one bar per day; hover (or focus) a day for its numbers */
function Bars({ days }: { days: Stats['days'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 120;
  const max = Math.max(1, ...days.map((d) => d.visits));
  const slot = W / days.length;
  const bar = Math.max(2, slot - 2); // a 2px gap between bars
  const shown = hover === null ? null : days[hover]!;
  return (
    <div className="admin-bars">
      <svg viewBox={`0 0 ${W} ${H + 1}`} role="img" aria-label={`visits a day: ${days.map((d) => d.visits).join(', ')}`} onPointerLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className="admin-axis" />
        {days.map((d, i) => {
          const h = d.visits ? Math.max(2, (d.visits / max) * (H - 6)) : 0;
          const x = i * slot + 1;
          return (
            <g key={d.day} onPointerEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {h > 0 && <path className={i === hover ? 'admin-bar-on' : 'admin-bar-mark'} d={roundTop(x, H, bar, h)} />}
            </g>
          );
        })}
      </svg>
      <div className="admin-ticks" aria-hidden>
        <span>{days[0]!.day.slice(5)}</span>
        <span>today</span>
      </div>
      <p className="admin-bars-note" aria-live="polite">
        {shown ? `${shown.day}: ${shown.visits} visits, ${shown.peak} at once` : `most in a day: ${max === 1 && !days.some((d) => d.visits) ? 0 : max}`}
      </p>
    </div>
  );
}

/** a bar standing on the baseline with its top corners rounded (4px, less for a short or thin bar) */
function roundTop(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  const y = base - h;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

function Pulls({ list }: { list: Pull[] }) {
  const CHECK = { pass: '✓ Check passed', fail: '✗ Check failed', running: '… Check running', none: 'no Check yet' } as const;
  return (
    <ul className="admin-list admin-pulls">
      {list.map((p) => (
        <li key={p.number}>
          <a href={p.url}>
            #{p.number} {p.title}
          </a>
          <span className="admin-meta">
            {p.who} · {ageLabel(p.age)}
            {p.draft ? ' · draft' : ''} · <span className={`admin-check ${p.check}`}>{CHECK[p.check]}</span> · <a href={p.preview}>preview</a>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Items({ list, none }: { list: { number: number; text: string; url: string; age: number }[]; none: string }) {
  if (!list.length) return none ? <p className="admin-quiet">{none}</p> : null;
  return (
    <ul className="admin-list">
      {list.map((i) => (
        <li key={i.number}>
          <a href={i.url}>#{i.number}</a> {i.text} <span className="admin-meta">· waiting {ageLabel(i.age)}</span>
        </li>
      ))}
    </ul>
  );
}
