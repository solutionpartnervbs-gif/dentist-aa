import { BRANCHES, CLINIC, SERVICES, STEPS } from '../config/clinic';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Reveal } from './Reveal';
import { useAssistant } from '../hooks/useAssistant';

export function Hero({ onBook }: { onBook: () => void }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="pill">{CLINIC.badge}</span>
          <h1>
            {CLINIC.headlineLead} <span className="accent">{CLINIC.headlineAccent}</span>
          </h1>
          <p className="lead">{CLINIC.heroLead}</p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onBook}>
              Book an appointment
            </button>
            <a className="btn btn-ghost btn-lg" href="#services">
              Our services
            </a>
          </div>
          <ul className="hero-facts" aria-label="At a glance">
            <li><strong>2</strong> branches</li>
            <li><strong>Mon–Sat</strong> appointments</li>
            <li><strong>After-hours</strong> by arrangement</li>
          </ul>
        </div>
        <div className="hero-photo">
          <img
            src="/images/dentist-thumbs-up-1024.webp"
            srcSet="/images/dentist-thumbs-up-640.webp 640w, /images/dentist-thumbs-up-1024.webp 1024w"
            sizes="(max-width: 900px) 100vw, 55vw"
            alt="Smiling dentist at the clinic giving a thumbs up"
            width="1024"
            height="861"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}

export function Services({ onPick }: { onPick: (service: string) => void }) {
  return (
    <section id="services" className="section">
      <div className="container">
        <Reveal>
          <h2>Our services</h2>
          <p className="section-sub">Choose a service to start your booking.</p>
        </Reveal>
        <ul className="grid-3 service-grid">
          {SERVICES.map((s, i) => (
            <li key={s.id}>
              <Reveal delay={i * 50}>
                <article className="card service-card">
                  <div className="service-img">
                    <img src={s.image} alt={s.imageAlt} width="570" height="492" loading="lazy" />
                  </div>
                  <div className="service-body">
                    <h3><span className="service-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
                    <p className="muted">{s.blurb}</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => onPick(s.id)} aria-label={`Book ${s.title}`}>
                      Book this
                    </button>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="section alt">
      <div className="container">
        <Reveal>
          <h2>Book in three simple steps</h2>
        </Reveal>
        <ol className="grid-3 steps-grid">
          {STEPS.map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 80}>
                <div className="card step-card">
                  <span className="step-n" aria-hidden>{s.n}</span>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Branches() {
  return (
    <section id="branches" className="section">
      <div className="container">
        <Reveal>
          <h2>Our branches</h2>
          <p className="section-sub">After-hours appointments are available by prior arrangement.</p>
        </Reveal>
        <div className="grid-2">
          {BRANCHES.map((b, i) => (
            <Reveal key={b.id} delay={i * 80}>
              <article className="card branch">
                <h3>{b.name}</h3>
                <p className="muted">{b.address}</p>
                <p>
                  <strong>{b.days}</strong>
                  <br />
                  {b.hours}
                </p>
                <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.mapQuery)}`}>
                  Get directions ↗
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { paused, setPaused, still, tips, setTips, findMilky, setOpen } = useAssistant();
  return (
    <footer className="footer">
      <div className="container footer-row">
        <Logo height={40} />
        <p className="muted small">© {new Date().getFullYear()} {CLINIC.name}. Appointments are confirmed by our team.</p>
        <div className="footer-milky">
          <button type="button" className="link-btn small" onClick={() => { setOpen(false); findMilky(); }}>Where’s Milky?</button>
          <button type="button" className="link-btn small" aria-pressed={tips} onClick={() => setTips(!tips)}>
            {tips ? 'Hide Milky’s tips' : 'Show Milky’s tips'}
          </button>
          <button type="button" className="link-btn small" aria-pressed={paused} onClick={() => setPaused(!paused)} disabled={still && !paused}>
            {paused ? 'Resume Milky’s motion' : 'Pause Milky’s motion'}
          </button>
        </div>
        <Link className="small footer-staff" to="/admin">Staff portal</Link>
      </div>
    </footer>
  );
}
