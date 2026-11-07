import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { CLINIC } from '../config/clinic';
import { useAssistant } from '../hooks/useAssistant';

const NAV = [
  ['#services', 'Services'],
  ['#how', 'How it works'],
  ['#branches', 'Branches'],
  ['#book', 'Book now'],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const { setOpen: openChat } = useAssistant();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link to="/" className="brand" aria-label={`${CLINIC.name} home`}>
          <Logo height={46} />
        </Link>
        <nav id="main-nav" className={`nav ${open ? 'open' : ''}`} aria-label="Main">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <button type="button" className="nav-chat" onClick={() => { setOpen(false); openChat(true); }}>
            Ask {CLINIC.assistantName}
          </button>
        </nav>
        <a href="#book" className="btn btn-primary header-cta">
          Book appointment
        </a>
        <button ref={btn} className="menu-btn" aria-expanded={open} aria-controls="main-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden>{open ? '✕' : '☰'}</span>
        </button>
      </div>
    </header>
  );
}
