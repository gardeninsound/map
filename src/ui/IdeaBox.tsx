import { useEffect, useRef, useState } from 'react';
import { input } from '../city';
import {
  IDEA_HINT,
  IDEA_MAX,
  IDEA_MIN,
  IDEA_NAME_HINT,
  IDEA_NAME_LABEL,
  IDEA_NAME_MAX,
  IDEA_NAME_PLACEHOLDER,
  IDEA_PLACEHOLDER,
  IDEA_PROMPT,
  IDEA_PUBLIC,
  IDEA_THANKS,
  IDEA_URL,
  TURNSTILE_SITEKEY,
  TURNSTILE_TEST_SITEKEY,
} from '../content/ideas';
import { sounds } from './sounds';

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

/** Loads Cloudflare Turnstile once, the first time the idea box opens. */
let turnstileLoading: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile')));
    s.onerror = () => {
      turnstileLoading = null; // let the next open try again
      reject(new Error('turnstile blocked'));
    };
    document.head.appendChild(s);
  });
  return turnstileLoading;
}

/** `?wish=` points at another Worker (e.g. `npm run dev` in wish/); a local one uses Turnstile's test key. */
function endpoint() {
  const url = new URLSearchParams(location.search).get('wish') ?? IDEA_URL;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
  return { url, sitekey: local ? TURNSTILE_TEST_SITEKEY : TURNSTILE_SITEKEY };
}

type Status =
  | { s: 'writing' }
  | { s: 'sending' }
  | { s: 'sent' }
  | { s: 'error'; message: string };

/**
 * "What would you love to add in the Garden in Sound?" A text box over the map; the idea
 * goes to the `wish/` Worker, which files it as a GitHub issue, credited to the optional
 * name. A real form: Tab runs idea → name → captcha → SEND → CANCEL → ✕ and wraps round
 * (never onto the map behind); Enter in the name field sends, Cmd/Ctrl+Enter sends from
 * anywhere; Esc / {B} closes.
 */
export function IdeaBox({ street, onClose }: { street: string | null; onClose(): void }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const [status, setStatus] = useState<Status>({ s: 'writing' });
  const area = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLFormElement>(null);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const { url, sitekey } = useRef(endpoint()).current;

  const trimmed = text.trim();
  const canSend = trimmed.length >= IDEA_MIN && !!token && status.s !== 'sending';

  // the captcha: Turnstile usually passes on its own while you type
  useEffect(() => {
    let gone = false;
    loadTurnstile()
      .then((t) => {
        if (gone || !captcha.current) return;
        widget.current = t.render(captcha.current, {
          sitekey,
          theme: 'light',
          size: 'flexible',
          callback: (tok: string) => {
            setToken(tok);
            setCaptchaFailed(false);
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null);
            setCaptchaFailed(true);
          },
        });
      })
      .catch(() => !gone && setCaptchaFailed(true));
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [sitekey]);

  useEffect(() => {
    area.current?.focus();
  }, []);

  // {B} closes when the text box doesn't have focus (keys typed in it never reach the game)
  useEffect(
    () =>
      input.on((b) => {
        if (b === 'b' && status.s !== 'sending') {
          input.consume('b');
          sounds.back();
          onClose();
        }
      }),
    [onClose, status.s],
  );

  const send = async () => {
    if (!canSend) return;
    setStatus({ s: 'sending' });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, name: name.trim() || undefined, token, street }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'The idea box is stuck right now. Try again later.');
      sounds.confirm();
      setStatus({ s: 'sent' });
    } catch (e) {
      sounds.back();
      // a Turnstile token works once: get a fresh one for the retry
      setToken(null);
      if (widget.current) window.turnstile?.reset(widget.current);
      const message = e instanceof TypeError ? "Couldn't reach the idea box. Check your connection and try again." : (e as Error).message;
      setStatus({ s: 'error', message });
    }
  };

  const close = () => {
    if (status.s === 'sending') return;
    sounds.back();
    onClose();
  };

  /** Tab wraps inside the box: from the last control back to the first, and the other way. */
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>('textarea, input, button, iframe')].filter(
      (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const thanks = name.trim() ? `Thank you, ${name.trim()}!` : IDEA_THANKS[0];

  return (
    <div className="idea-layer" onClick={close}>
      <form
        ref={dialog}
        className="idea"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-title"
        noValidate
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        onKeyDown={(e) => {
          trapTab(e);
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
      >
        <h2 id="idea-title">{IDEA_PROMPT}</h2>

        {status.s === 'sent' ? (
          <div className="idea-thanks" role="status">
            <p className="idea-thanks-big">✿ {thanks}</p>
            <p>{IDEA_THANKS[1]}</p>
            <div className="idea-actions">
              <button type="button" className="primary" onClick={onClose} autoFocus>
                BACK TO THE MAP
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="idea-hint" id="idea-hint">{IDEA_HINT}</p>
            <textarea
              id="idea-text"
              ref={area}
              value={text}
              maxLength={IDEA_MAX}
              placeholder={IDEA_PLACEHOLDER}
              aria-labelledby="idea-title"
              aria-describedby="idea-hint idea-public"
              disabled={status.s === 'sending'}
              onChange={(e) => {
                setText(e.target.value);
                if (status.s === 'error') setStatus({ s: 'writing' });
              }}
            />
            <div className="idea-meta">
              <span id="idea-public">{IDEA_PUBLIC}</span>
              <span className="idea-count">
                {text.length}/{IDEA_MAX}
              </span>
            </div>
            <div className="idea-name">
              <label htmlFor="idea-name">{IDEA_NAME_LABEL}</label>
              <input
                id="idea-name"
                type="text"
                value={name}
                maxLength={IDEA_NAME_MAX}
                placeholder={IDEA_NAME_PLACEHOLDER}
                autoComplete="nickname"
                enterKeyHint="send"
                aria-describedby="idea-name-hint"
                disabled={status.s === 'sending'}
                onChange={(e) => setName(e.target.value)}
              />
              <span id="idea-name-hint" className="idea-name-hint">{IDEA_NAME_HINT}</span>
            </div>
            <div className="idea-captcha" ref={captcha} />
            {captchaFailed && (
              <p className="idea-error" role="alert">
                The "are you a person?" check didn't load. An ad blocker may be stopping it (it comes from
                challenges.cloudflare.com).
              </p>
            )}
            {status.s === 'error' && (
              <p className="idea-error" role="alert">
                {status.message}
              </p>
            )}
            <div className="idea-actions">
              <button type="submit" className="primary" disabled={!canSend}>
                {status.s === 'sending' ? 'PLANTING…' : 'SEND IDEA'}
              </button>
              <button type="button" onClick={close} disabled={status.s === 'sending'}>
                CANCEL
              </button>
            </div>
          </>
        )}
        {/* last in the tab order; drawn in the top corner */}
        <button type="button" className="spots-close idea-close" onClick={close} aria-label="Close">
          ✕
        </button>
      </form>
    </div>
  );
}
