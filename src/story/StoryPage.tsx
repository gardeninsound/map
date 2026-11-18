/**
 * /story/: how the island grew. Reads the story log (scripts/story/) straight from the story
 * branch, so it's current without a deploy. Not linked from the map yet.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  anchorOf,
  applyFilter,
  dateLabel,
  groupByMonth,
  growth,
  stats,
  waitDays,
  waitingWishes,
  wipeAt,
  wipeKey,
  type Filter,
  type Series,
  type StoryChange,
  type StoryIndex,
  type StoryShot,
  tagCounts,
  withTag,
} from './model';

type Load = { state: 'loading' } | { state: 'empty' } | { state: 'error'; message: string } | { state: 'ok'; idx: StoryIndex };

export function StoryPage({ src }: { src: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${src}story.json`, { cache: 'no-cache' })
      .then(async (r) => {
        if (r.status === 404) return live && setLoad({ state: 'empty' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const idx = (await r.json()) as StoryIndex;
        if (live) setLoad(idx.changes.length ? { state: 'ok', idx } : { state: 'empty' });
      })
      .catch((e: Error) => live && setLoad({ state: 'error', message: e.message }));
    return () => {
      live = false;
    };
  }, [src]);

  // a #pr-64 link: scroll to it once the log is in
  useEffect(() => {
    if (load.state === 'ok' && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [load.state]);

  return (
    <div className="story">
      <header className="story-head">
        <p className="story-kicker">Garden in Sound · the story log</p>
        <h1 className="story-title">How the island grew</h1>
        <p className="story-lede">
          Every change that went live on the map, newest first: the wish that started it, in the visitor's own words, what got made,
          and how the spot looked before and after.
        </p>
      </header>
      {load.state === 'loading' && <p className="story-note">Unrolling the log…</p>}
      {load.state === 'empty' && <p className="story-note">The story log hasn't started yet. It begins with the next change to the map.</p>}
      {load.state === 'error' && <p className="story-note">Couldn't read the story log ({load.message}). Try again in a minute.</p>}
      {load.state === 'ok' && <Story idx={load.idx} src={src} filter={filter} setFilter={setFilter} tag={tag} setTag={setTag} />}
      <footer className="story-foot">
        Written automatically as the map changes, from the project's{' '}
        <a href="https://github.com/gardeninsound/map/tree/story">story branch</a>. <a href={import.meta.env.BASE_URL}>Back to the map →</a>
      </footer>
    </div>
  );
}

type StoryProps = { idx: StoryIndex; src: string; filter: Filter; setFilter: (f: Filter) => void; tag: string | null; setTag: (t: string | null) => void };
function Story({ idx, src, filter, setFilter, tag, setTag }: StoryProps) {
  const s = useMemo(() => stats(idx), [idx]);
  const series = useMemo(() => growth(idx), [idx]);
  const months = useMemo(() => groupByMonth(withTag(applyFilter(idx.changes, filter), tag)), [idx, filter, tag]);
  const tags = useMemo(() => tagCounts(idx.changes), [idx]);
  const pickTag = (t: string) => {
    setTag(t === tag ? null : t);
    document.querySelector('.story-filters')?.scrollIntoView({ block: 'start' });
  };
  const waiting = useMemo(() => waitingWishes(idx), [idx]);
  const FILTERS: [Filter, string][] = [
    ['all', `Everything · ${idx.changes.length}`],
    ['wishes', `Answered a wish · ${applyFilter(idx.changes, 'wishes').length}`],
    ['pictures', `With pictures · ${applyFilter(idx.changes, 'pictures').length}`],
  ];
  return (
    <>
      <section className="story-stats" aria-label="So far">
        <Stat n={s.changes} label="changes" />
        <Stat n={s.wishes} label="wishes from visitors" />
        <Stat n={s.answered} label="wishes answered" />
        {s.medianWait !== null && <Stat n={s.medianWait} label="days, wish to live (median)" />}
        {s.firstDay && <Stat n={dateLabel(s.firstDay)} label="the first day" small />}
      </section>

      {series.length > 0 && (
        <section className="story-growth" aria-label="How it grew">
          {series.map((g) => (
            <Spark key={g.key} series={g} />
          ))}
        </section>
      )}

      <nav className="story-filters" aria-label="Show">
        {FILTERS.map(([f, label]) => (
          <button key={f} className={f === filter ? 'on' : ''} aria-pressed={f === filter} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </nav>
      {tags.length > 0 && (
        <nav className="story-tags" aria-label="Tags">
          {tags.map(({ tag: t, n }) => (
            <button key={t} className={t === tag ? 'on' : ''} aria-pressed={t === tag} onClick={() => pickTag(t)}>
              {t} <span>{n}</span>
            </button>
          ))}
        </nav>
      )}

      <main className="story-log">
        {months.map((m) => (
          <section key={m.month}>
            <h2 className="story-month">{m.label}</h2>
            {m.days.map((d) => (
              <div key={d.day} className="story-day">
                <h3 className="story-daylabel">{d.label}</h3>
                {d.changes.map((c) => (
                  <Change key={c.sha} c={c} src={src} tag={tag} onTag={pickTag} />
                ))}
              </div>
            ))}
          </section>
        ))}
      </main>

      {waiting.length > 0 && (
        <section className="story-waiting">
          <h2 className="story-month">Wishes still waiting</h2>
          <ul>
            {waiting.map((w) => (
              <li key={w.issue}>
                <q>{w.text}</q>
                <span className="story-who">
                  {' '}
                  {w.name ? `${w.name}, ` : ''}
                  {dateLabel(w.asked_at)} · <a href={w.url}>#{w.issue}</a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ n, label, small }: { n: number | string; label: string; small?: boolean }) {
  return (
    <div className="story-stat">
      <span className={small ? 'n small' : 'n'}>{n}</span>
      <span className="l">{label}</span>
    </div>
  );
}

/** one measure over time: a step line (values only change when a change lands), hover for the value */
function Spark({ series }: { series: Series }) {
  const W = 240;
  const H = 64;
  const P = 6;
  const pts = series.points;
  const [hover, setHover] = useState<number | null>(null);
  const t0 = pts[0].t;
  const t1 = Math.max(pts.at(-1)!.t, Date.now());
  const vMax = Math.max(...pts.map((p) => p.v), 1);
  const x = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / vMax) * (H - 2 * P);
  let d = `M${x(pts[0].t)},${y(pts[0].v)}`;
  for (const p of pts.slice(1)) d += ` H${x(p.t)} V${y(p.v)}`;
  d += ` H${x(t1)}`;
  const last = pts.at(-1)!;
  const shown = hover === null ? null : pts[hover];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tx = t0 + (((e.clientX - r.left) / r.width) * W - P) / (W - 2 * P) * (t1 - t0);
    let i = 0;
    while (i + 1 < pts.length && pts[i + 1].t <= tx) i++;
    setHover(i);
  };
  return (
    <figure className="story-spark">
      <figcaption>
        <span>{series.label}</span>
        <b>{shown ? shown.v : last.v}</b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.label}: ${pts[0].v} to ${last.v}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="axis" />
        <path d={d} className="line" />
        {shown && <circle cx={x(shown.t)} cy={y(shown.v)} r={4} className="dot" />}
        {!shown && <circle cx={x(last.t)} cy={y(last.v)} r={4} className="dot" />}
      </svg>
      <p className="story-spark-tip">{shown ? `${dateLabel(shown.at)} · ${shown.what.slice(0, 70)}` : `since ${dateLabel(pts[0].at)}`}</p>
    </figure>
  );
}

function Change({ c, src, tag, onTag }: { c: StoryChange; src: string; tag: string | null; onTag: (t: string) => void }) {
  const [more, setMore] = useState(false);
  const words = c.story.note ?? c.summary;
  const long = (words?.length ?? 0) > 280;
  return (
    <article className="story-change" id={anchorOf(c)}>
      <h4 className="story-change-title">
        <a href={`#${anchorOf(c)}`}>{c.title}</a>
      </h4>
      {c.ideas.map((w) => (
        <blockquote key={w.issue} className="story-wish">
          <p>{w.text}</p>
          <footer>
            {w.name ?? 'a visitor'}
            {w.street ? ` on ${w.street}` : ''}
            {w.asked_at ? `, ${dateLabel(w.asked_at)}` : ''} · <a href={w.url}>wish #{w.issue}</a>
            {w.asked_at && <span className="story-wait"> · live {waitDays(w.asked_at, c.merged_at)} days later</span>}
          </footer>
        </blockquote>
      ))}
      {c.story.askedVsMade && (
        <p className="story-avm">
          <b>Asked vs made</b> {c.story.askedVsMade}
        </p>
      )}
      {c.story.mike && (
        <p className="story-mike">
          <b>Mike</b> {c.story.mike}
        </p>
      )}
      {words && (
        <div className={`story-words${long && !more ? ' clipped' : ''}`}>
          {words.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para.replace(/\n/g, ' ')}</p>
          ))}
        </div>
      )}
      {long && (
        <button className="story-more" onClick={() => setMore(!more)}>
          {more ? 'less' : 'more'}
        </button>
      )}
      {c.shots.filter((s) => s.after).map((s, i) => (
        <Shot key={i} shot={s} src={src} />
      ))}
      {(c.tags?.length ?? 0) > 0 && (
        <p className="story-change-tags">
          {c.tags!.map((t) => (
            <button key={t} className={t === tag ? 'on' : ''} onClick={() => onTag(t)} title={t === tag ? 'show everything' : `show every ${t} change`}>
              {t}
            </button>
          ))}
        </p>
      )}
      <p className="story-meta">
        {c.authors.join(', ') || 'someone'}
        {' · '}{c.files} files, +{c.additions} −{c.deletions}
        {!c.tags?.length && c.areas.length ? ` · ${c.areas.join(', ')}` : ''} · <a href={c.url}>{c.pr ? `#${c.pr}` : c.sha.slice(0, 7)}</a> ·{' '}
        <a href={`${src}${c.dir}/entry.json`}>record</a>
      </p>
    </article>
  );
}

/** before/after: grab the line (or press anywhere on the photo) and drag to wipe between them; or watch the place move */
function Shot({ shot, src }: { shot: StoryShot; src: string }) {
  const [pos, setPos] = useState(50);
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const url = (p: string) => `${src}${p}`;
  const alt = shot.label ? `the map at ${shot.label}` : 'the map';
  const wipe = !!shot.before && !(moving && shot.moving);
  const follow = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos(wipeAt(e.clientX, r.left, r.width));
  };
  const drag = wipe
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          follow(e);
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => dragging && follow(e),
        onPointerUp: () => setDragging(false),
        onPointerCancel: () => setDragging(false),
      }
    : {};
  return (
    <figure className="story-shot">
      <div className={`story-frame${wipe ? ' wipe' : ''}${dragging ? ' dragging' : ''}`} {...drag}>
        {moving && shot.moving ? (
          <img src={url(shot.moving)} alt={`${alt}, moving`} />
        ) : (
          <>
            <img src={url(shot.after!)} alt={`${alt}, after`} loading="lazy" draggable={false} />
            {shot.before && (
              <img className="before" src={url(shot.before)} alt={`${alt}, before`} loading="lazy" draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
            )}
          </>
        )}
        {wipe && (
          <>
            <span className="story-tag before" style={{ opacity: pos > 12 ? 1 : 0 }} aria-hidden>
              before
            </span>
            <span className="story-tag after" style={{ opacity: pos < 88 ? 1 : 0 }} aria-hidden>
              after
            </span>
            <span
              className="story-wipe"
              style={{ left: `${pos}%` }}
              role="slider"
              tabIndex={0}
              aria-label="wipe from before to after"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos)}
              aria-valuetext={`${Math.round(pos)}% before`}
              onKeyDown={(e) => {
                const next = wipeKey(pos, e.key, e.shiftKey);
                if (next === null) return;
                e.preventDefault();
                setPos(next);
              }}
            >
              <span className="story-knob" />
            </span>
          </>
        )}
      </div>
      <figcaption>
        {shot.label && <span className="story-place">{shot.label}</span>}
        {shot.moving && (
          <button className="story-more" onClick={() => setMoving(!moving)}>
            {moving ? '■ still' : '▶ watch it'}
          </button>
        )}
        {shot.lat !== null && (
          <a className="story-visit" href={`${import.meta.env.BASE_URL}?at=${shot.lat},${shot.lon}`}>
            walk there →
          </a>
        )}
      </figcaption>
    </figure>
  );
}
