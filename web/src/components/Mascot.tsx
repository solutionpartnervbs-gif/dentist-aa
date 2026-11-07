import { useEffect, useRef, useState } from 'react';
import { CLINIC } from '../config/clinic';
import { DIALOGUE } from '../config/dialogue';
import { useAssistant } from '../hooks/useAssistant';
import { mascotSpot, type Spot } from '../lib';

/** Where Milky rests while each part of the page is on screen. Order = page order. */
const JOURNEY: { key: string; selector: string; spot: Spot }[] = [
  { key: 'hero', selector: '.hero', spot: 'br' },
  { key: 'services', selector: '#services', spot: 'ml' },
  { key: 'book', selector: '#book', spot: 'mr' },
  { key: 'how', selector: '#how', spot: 'ml' },
  { key: 'branches', selector: '#branches', spot: 'mr' },
];
const TRAVEL_MS = 1300;
const SEEN_KEY = 'suyat_milky_seen';
const BUBBLE_W = 200;

const sizeFor = (vw: number) => (vw < 640 ? 60 : 76);

function activeSection() {
  const line = window.innerHeight * 0.4;
  let current = JOURNEY[0];
  for (const j of JOURNEY) {
    const el = document.querySelector(j.selector);
    if (el && el.getBoundingClientRect().top <= line) current = j;
  }
  return current;
}

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function markSeen(key: string) {
  try {
    const s = seen();
    s.add(key);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export function Mascot() {
  const { open, toggle, activity, still, bubble, say, dismissBubble, locateNonce } = useAssistant();
  const [pos, setPos] = useState<{ x: number; y: number }>(() => mascotSpot('br', window.innerWidth, window.innerHeight, sizeFor(window.innerWidth)));
  const [hopping, setHopping] = useState(false);
  const [locating, setLocating] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [wander, setWander] = useState({ x: 0, y: 0 });
  const spot = useRef<Spot>('br');
  const lastX = useRef(pos.x);
  const hopTimer = useRef<number | undefined>(undefined);
  const dwell = useRef<number | undefined>(undefined);
  const sectionKey = useRef('hero');
  const btn = useRef<HTMLButtonElement>(null);
  const sayRef = useRef(say);
  sayRef.current = say;

  // Travel between sections as the visitor scrolls, and offer a suggestion once they have lingered in one.
  useEffect(() => {
    const place = (animate: boolean) => {
      const size = sizeFor(window.innerWidth);
      const section = activeSection();
      const target = still || open ? 'br' : section.spot;
      const next = mascotSpot(target, window.innerWidth, window.innerHeight, size);
      const moved = target !== spot.current || Math.abs(next.x - lastX.current) > 4;
      setTilt(Math.max(-14, Math.min(14, (next.x - lastX.current) / 40)));
      spot.current = target;
      lastX.current = next.x;
      setPos(next);
      if (animate && moved && !still && !open) {
        setHopping(true);
        window.clearTimeout(hopTimer.current);
        hopTimer.current = window.setTimeout(() => setHopping(false), TRAVEL_MS);
      }
      if (section.key !== sectionKey.current) {
        sectionKey.current = section.key;
        window.clearTimeout(dwell.current);
        const text = DIALOGUE.suggestions[section.key];
        if (text && !open && !seen().has(`s:${section.key}`)) {
          dwell.current = window.setTimeout(() => {
            markSeen(`s:${section.key}`);
            sayRef.current(text);
          }, 1800);
        }
      }
    };
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => place(true));
    };
    place(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hopTimer.current);
      window.clearTimeout(dwell.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [still, open]);

  // Idle: now and then drift a little so it feels alive without leaving its area.
  useEffect(() => {
    if (still || open) {
      setWander({ x: 0, y: 0 });
      return;
    }
    const id = window.setInterval(() => {
      setWander({ x: Math.round((Math.random() - 0.5) * 56), y: Math.round((Math.random() - 0.5) * 40) });
    }, 4500);
    return () => window.clearInterval(id);
  }, [still, open]);

  // Greeting, then "trying to help": once per visit.
  useEffect(() => {
    if (seen().has('greeted')) return;
    const t1 = window.setTimeout(() => {
      markSeen('greeted');
      sayRef.current(DIALOGUE.greeting(new Date().getHours()));
    }, 1500);
    const t2 = window.setTimeout(() => sayRef.current(DIALOGUE.trying), 1500 + 7500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // "Where is Milky?": hop, ring pulse and a hello, even when tips are switched off.
  useEffect(() => {
    if (!locateNonce) return;
    setHopping(true);
    setLocating(true);
    sayRef.current(DIALOGUE.here, { urgent: true, force: true });
    const a = window.setTimeout(() => setHopping(false), TRAVEL_MS);
    const b = window.setTimeout(() => setLocating(false), 3600);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [locateNonce]);

  // Return focus to the icon when the chat closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) btn.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const size = sizeFor(vw);
  // keep the bubble on screen: centre it over the icon, then clamp to the viewport edges
  const bubbleLeft = Math.min(Math.max(pos.x + size / 2 - BUBBLE_W / 2, 8), vw - BUBBLE_W - 8) - pos.x;

  return (
    <div
      className={`mascot ${still ? 'is-still' : ''} ${open ? 'is-open' : ''}`}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, width: size, height: size }}
    >
      <div className="mascot-drift" style={{ transform: `translate3d(${wander.x}px, ${wander.y}px, 0)` }}>
        {bubble && !open && (
          <button
            key={bubble.id}
            type="button"
            className="mascot-bubble"
            style={{ left: bubbleLeft, width: BUBBLE_W }}
            onClick={dismissBubble}
            aria-label={`${CLINIC.assistantName} says: ${bubble.text}. Tap to dismiss.`}
            role="status"
          >
            <span className="mascot-bubble-name">{CLINIC.assistantName}</span>
            {bubble.text}
          </button>
        )}
        <button
          ref={btn}
          type="button"
          className={`mascot-btn mascot-btn--${activity} ${hopping ? 'is-hopping' : ''} ${locating ? 'is-locating' : ''}`}
          style={{ ['--tilt' as string]: `${tilt}deg`, width: size, height: size }}
          aria-label={open ? `Close chat with ${CLINIC.assistantName}` : `Chat with ${CLINIC.assistantName}`}
          aria-expanded={open}
          aria-controls="chat-popup"
          onClick={() => {
            dismissBubble();
            toggle();
          }}
        >
          <img src={CLINIC.assistantIcon} srcSet={`${CLINIC.assistantIconSmall} 112w, ${CLINIC.assistantIcon} 384w`} sizes={`${size}px`} alt="" width={size} height={size} draggable={false} />
        </button>
      </div>
    </div>
  );
}
