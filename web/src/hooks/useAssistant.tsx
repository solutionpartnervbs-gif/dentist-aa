import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Activity = 'idle' | 'thinking';

export interface Bubble {
  id: number;
  text: string;
}

interface AssistantState {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  activity: Activity;
  setActivity: (a: Activity) => void;
  /** User chose to stop the icon moving. */
  paused: boolean;
  setPaused: (v: boolean) => void;
  /** True when the icon must hold still: the user paused it, or their system asks for reduced motion. */
  still: boolean;
  /** Milky's speech bubbles on/off (the user can switch them off). */
  tips: boolean;
  setTips: (v: boolean) => void;
  /** The bubble currently showing, if any. */
  bubble: Bubble | null;
  /** Make Milky say something. Throttled so it never chatters; `urgent` lines (help with an error) always get through. */
  say: (text: string, opts?: { urgent?: boolean; force?: boolean }) => void;
  dismissBubble: () => void;
  /** "Where is Milky?": hop over, wave and say hello. */
  findMilky: () => void;
  locateNonce: number;
}

const Ctx = createContext<AssistantState | null>(null);
const PAUSE_KEY = 'suyat_mascot_paused';
const TIPS_KEY = 'suyat_milky_tips';
const SHOW_MS = 7000;
const MIN_GAP_MS = 2500;

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function writeFlag(key: string, v: boolean) {
  try {
    window.localStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* storage blocked: the choice just won't persist */
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<Activity>('idle');
  const [paused, setPausedState] = useState(() => readFlag(PAUSE_KEY, false));
  const [tips, setTipsState] = useState(() => readFlag(TIPS_KEY, true));
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [locateNonce, setLocateNonce] = useState(0);
  const reduced = useReducedMotion();
  const lastSay = useRef(0);
  const hideTimer = useRef<number | undefined>(undefined);
  const seq = useRef(0);
  const tipsRef = useRef(tips);
  tipsRef.current = tips;

  const dismissBubble = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setBubble(null);
  }, []);

  const say = useCallback((text: string, opts?: { urgent?: boolean; force?: boolean }) => {
    if (!tipsRef.current && !opts?.force) return; // `force` is for lines the visitor asked for, e.g. "Where is Milky?"
    const now = Date.now();
    if (!opts?.urgent && now - lastSay.current < MIN_GAP_MS) return;
    lastSay.current = now;
    window.clearTimeout(hideTimer.current);
    setBubble({ id: ++seq.current, text });
    hideTimer.current = window.setTimeout(() => setBubble(null), SHOW_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  const setPaused = useCallback((v: boolean) => {
    setPausedState(v);
    writeFlag(PAUSE_KEY, v);
  }, []);
  const setTips = useCallback(
    (v: boolean) => {
      setTipsState(v);
      writeFlag(TIPS_KEY, v);
      if (!v) dismissBubble();
    },
    [dismissBubble],
  );
  const findMilky = useCallback(() => {
    // On a phone the chat sheet covers Milky, so close it to let the visitor see the wave.
    if (window.innerWidth < 640) setOpen(false);
    setLocateNonce((n) => n + 1);
  }, []);

  const value = useMemo<AssistantState>(
    () => ({
      open, setOpen, toggle: () => setOpen((o) => !o), activity, setActivity,
      paused, setPaused, still: paused || reduced,
      tips, setTips, bubble, say, dismissBubble, findMilky, locateNonce,
    }),
    [open, activity, paused, reduced, setPaused, tips, setTips, bubble, say, dismissBubble, findMilky, locateNonce],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant(): AssistantState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAssistant must be used inside <AssistantProvider>');
  return v;
}
