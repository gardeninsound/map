import { useEffect, useMemo, useState } from 'react';
import { arcadeGames } from '../content/duckArcade';
import { locations } from '../content/locations';
import {
  ageLabel,
  checkOf,
  daily,
  lastDays,
  nameOf,
  otherIssues,
  pullOf,
  spotsTodo,
  sumDays,
  totals,
  wishesOf,
  type GhCheckRuns,
  type GhIssue,
  type GhPull,
  type Names,
  type Pull,
  type Ranked,
  type Stats,
  type Traffic,
} from './model';

type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; data: T };
const names: Names = { places: locations, games: arcadeGames };

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache' });
  if (r.status === 401) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? 'not signed in');
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

export function AdminPage({ stats, traffic, github }: { stats: string; traffic: string; github: string }) {
  const counts = useLoad(() => json<Stats>(stats), [stats]);
  const site = useLoad(() => json<Traffic>(traffic), [traffic]);
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

      <section className="admin-card" aria-labelledby="traffic">
        <h2 id="traffic">The whole site (Cloudflare)</h2>
        <p className="admin-quiet admin-why">Everyone who loads gardeninsound.website, including those who never press start.</p>
        {site.state === 'loading' && <p className="admin-quiet">Asking Cloudflare…</p>}
        {site.state === 'error' && <p className="admin-quiet">Couldn't read it ({site.message}).</p>}
        {site.state === 'ok' && <SiteTraffic t={site.data} today={counts.state === 'ok' ? counts.data.today : site.data.generated_at.slice(0, 10)} />}
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
        Only Mike and Jim can open this page (Cloudflare Access). Counts are anonymous, per day, from the live site (relay/README.md). <a href={import.meta.env.BASE_URL}>Back to the map →</a> ·{' '}
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
      <VisitBars s={s} />
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

/** one bar per day; hover a day for its numbers (`say` puts a day in words) */
function Bars({ days, say }: { days: { day: string; n: number }[]; say: (i: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 120;
  const max = Math.max(0, ...days.map((d) => d.n));
  const slot = W / days.length;
  const bar = Math.max(2, slot - 2); // a 2px gap between bars
  return (
    <div className="admin-bars">
      <svg viewBox={`0 0 ${W} ${H + 1}`} role="img" aria-label={days.map((d) => `${d.day}: ${d.n}`).join(', ')} onPointerLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className="admin-axis" />
        {days.map((d, i) => {
          const h = d.n ? Math.max(2, (d.n / Math.max(1, max)) * (H - 6)) : 0;
          return (
            <g key={d.day} onPointerEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {h > 0 && <path className={i === hover ? 'admin-bar-on' : 'admin-bar-mark'} d={roundTop(i * slot + 1, H, bar, h)} />}
            </g>
          );
        })}
      </svg>
      <div className="admin-ticks" aria-hidden>
        <span>{days[0]!.day.slice(5)}</span>
        <span>today</span>
      </div>
      <p className="admin-bars-note" aria-live="polite">
        {hover === null ? `most in a day: ${max}` : say(hover)}
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

function VisitBars({ s }: { s: Stats }) {
  const days = lastDays(s, 30);
  return <Bars days={days.map((d) => ({ day: d.day, n: d.visits }))} say={(i) => `${days[i]!.day}: ${days[i]!.visits} visits, ${days[i]!.peak} at once`} />;
}

function SiteTraffic({ t, today }: { t: Traffic; today: string }) {
  const zone = 'days' in t.zone ? t.zone.days : null;
  const web = 'days' in t.web ? t.web : null;
  return (
    <>
      {zone ? (
        <>
          <div className="admin-tiles">
            <Tile n={sumDays(zone, today, 7, (d) => d.visitors)} label="visitors, last 7 days" />
            <Tile n={sumDays(zone, today, 7, (d) => d.pageViews)} label="page views, last 7 days" />
            <Tile n={sumDays(zone, today, 30, (d) => d.visitors)} label="visitors, last 30 days" />
          </div>
          <h3>Visitors a day, last 30 days</h3>
          <Bars
            days={daily(zone, today, 30, (d) => d.visitors)}
            say={(i) => {
              const day = daily(zone, today, 30, (d) => d.visitors)[i]!.day;
              const z = zone.find((d) => d.day === day);
              return `${day}: ${z?.visitors ?? 0} visitors, ${z?.pageViews ?? 0} page views`;
            }}
          />
          <p className="admin-quiet admin-why">Cloudflare counts a visitor once a day per device, and its days are UTC.</p>
        </>
      ) : (
        <p className="admin-quiet">Visitors: {(t.zone as { error: string }).error}</p>
      )}
      {web ? (
        <div className="admin-ranks">
          <Rank title="Where they came from" list={web.referrers} />
          <Rank title="Pages" list={web.pages} />
          <Rank title="Countries" list={web.countries} />
          <Rank title="Devices" list={web.devices} />
        </div>
      ) : (
        <p className="admin-quiet">Where they came from: {(t.web as { error: string }).error}</p>
      )}
      {web && <p className="admin-quiet admin-why">Last 7 days, by visits, from Cloudflare Web Analytics (no cookies).</p>}
    </>
  );
}

function Rank({ title, list }: { title: string; list: Ranked }) {
  return (
    <div>
      <h3>{title}</h3>
      {list.length === 0 ? (
        <p className="admin-quiet">nothing yet</p>
      ) : (
        <ol className="admin-rank">
          {list.slice(0, 8).map((r) => (
            <li key={r.name}>
              <span>{r.name}</span> <b>{r.n}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
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
