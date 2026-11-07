import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SERVICES } from '../config/clinic';
import { DIALOGUE } from '../config/dialogue';
import { useAssistant } from '../hooks/useAssistant';
import { formatDateLong, formatTime, isPhMobile, manilaDate } from '../lib';

interface Availability {
  open: boolean;
  reason?: 'closed' | 'past' | 'too_far' | 'fully_booked';
  branch: { name: string; address: string; hours: string } | null;
  slots: string[];
}
interface Booked {
  id: string;
  reference: string;
  receiptPath: string;
  service: string;
  date: string;
  time: string;
  branch: string;
  address: string;
}
type Errors = Partial<Record<'service' | 'date' | 'time' | 'name' | 'phone' | 'email', string>>;

const REASONS: Record<string, string> = {
  closed: 'We are closed on Sundays. Please choose another day.',
  past: 'That date has passed. Please choose today or a later date.',
  too_far: 'Bookings open up to 90 days ahead. Please choose an earlier date.',
  fully_booked: 'That day is fully booked. Please try another date.',
};

export function BookingForm({ preselect }: { preselect: { service: string; nonce: number } | null }) {
  const uid = useId();
  const { say } = useAssistant();
  const id = (k: string) => `${uid}-${k}`;
  const min = useMemo(() => manilaDate(0), []);
  const max = useMemo(() => manilaDate(90), []);

  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<Booked | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (preselect) setService(preselect.service);
  }, [preselect]);

  const loadSlots = (d: string, signal?: AbortSignal) => {
    setLoadingSlots(true);
    setSlotsFailed(false);
    fetch(`/api/availability?date=${encodeURIComponent(d)}`, { signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const a = (await r.json()) as Availability;
        setAvail(a);
        if (!a.open) say(a.reason === 'closed' ? DIALOGUE.form.closed : DIALOGUE.form.full);
        else if (a.slots.length === 0) say(DIALOGUE.form.full);
        else say(DIALOGUE.form.slots(a.branch?.name ?? 'clinic'));
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== 'AbortError') setSlotsFailed(true);
      })
      .finally(() => setLoadingSlots(false));
  };

  // Fetch open times whenever the date changes; ignore stale responses.
  useEffect(() => {
    setTime('');
    setAvail(null);
    if (!date) return;
    const ac = new AbortController();
    loadSlots(date, ac.signal);
    return () => ac.abort();
  }, [date]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!service) e.service = 'Choose a service.';
    if (!date) e.date = 'Choose a date.';
    if (date && avail && !avail.open) e.date = REASONS[avail.reason ?? 'closed'];
    if (date && !time) e.time = 'Choose a time.';
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (!isPhMobile(phone)) e.phone = 'Enter a Philippine mobile number, for example 0917 123 4567.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Enter a valid email address or leave it blank.';
    return e;
  };

  // Check a field when the visitor leaves it, but only if they typed something. Telling someone their empty field is wrong
  // the moment they tab past it is noisy, and the new message pushes the layout down, which can swallow the click they were making.
  const blur = (k: keyof Errors) => {
    const filled = { service, date, time, name, phone, email }[k];
    if (!filled) return;
    const v = validate();
    setErrors((prev) => ({ ...prev, [k]: v[k] }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    const v = validate();
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) {
      const first = Object.values(v).find(Boolean);
      if (first) say(DIALOGUE.form.help(first), { urgent: true });
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, service, date, time }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Errors; refresh?: boolean } & Partial<Booked>;
      if (res.ok) {
        setDone(data as Booked);
        say(DIALOGUE.form.success, { urgent: true });
        return;
      }
      setErrors(data.fields ?? {});
      setFormError(data.error ?? 'We could not book that right now. Please try again.');
      say(DIALOGUE.form.failed, { urgent: true });
      if (data.refresh) {
        setTime('');
        loadSlots(date);
      }
      setTimeout(() => summaryRef.current?.focus(), 0);
    } catch {
      setFormError('Connection problem. Please check your internet and try again.');
      setTimeout(() => summaryRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setDone(null);
    setService('');
    setDate('');
    setTime('');
    setName('');
    setPhone('');
    setEmail('');
    setErrors({});
    setFormError('');
  };

  if (done) {
    return (
      <div className="book-card book-done">
        <div className="success-mark" aria-hidden>✓</div>
        <h3 tabIndex={-1} ref={doneRef}>Your appointment is booked</h3>
        <p className="muted">Reference <strong className="ref">{done.reference}</strong>. Please arrive 10–15 minutes early and bring a government ID.</p>
        <dl className="summary-list">
          <div><dt>Service</dt><dd>{done.service}</dd></div>
          <div><dt>Date</dt><dd>{formatDateLong(done.date)}</dd></div>
          <div><dt>Time</dt><dd>{formatTime(done.time)}</dd></div>
          <div><dt>Branch</dt><dd>{done.branch}<br /><span className="muted">{done.address}</span></dd></div>
        </dl>
        <div className="row-gap">
          <Link className="btn btn-primary" to={done.receiptPath} target="_blank">View proof of appointment</Link>
          <button className="btn btn-ghost" type="button" onClick={reset}>Book another visit</button>
        </div>
        <p className="muted small">Need to change or cancel? Do it at least 24 hours ahead using the chat below or by contacting the clinic.</p>
      </div>
    );
  }

  const errCount = Object.keys(errors).length;
  const err = (k: keyof Errors) => (errors[k] ? `${id(k)}-err` : undefined);

  return (
    <form className="book-card" onSubmit={submit} noValidate aria-busy={submitting} aria-labelledby={id('title')}>
      <h3 id={id('title')} className="sr-only">Book an appointment</h3>

      {(errCount > 0 || formError) && (
        <div className="summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <strong>{formError || `Please fix ${errCount} ${errCount === 1 ? 'thing' : 'things'} before booking:`}</strong>
          {errCount > 0 && (
            <ul>
              {(Object.keys(errors) as (keyof Errors)[]).filter((k) => errors[k]).map((k) => (
                <li key={k}><a href={`#${id(k)}`}>{errors[k]}</a></li>
              ))}
            </ul>
          )}
        </div>
      )}

      <fieldset className="group" disabled={submitting}>
        <legend>1 · Your visit</legend>
        <div className="grid">
          <div className="field">
            <label htmlFor={id('service')}>Service</label>
            <select id={id('service')} value={service} onChange={(e) => { setService(e.target.value); const s = SERVICES.find((x) => x.id === e.target.value); if (s) say(DIALOGUE.form.service(s.title)); }} onBlur={() => blur('service')} aria-invalid={!!errors.service} aria-describedby={err('service')} required>
              <option value="">Select a service</option>
              {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            {errors.service && <p className="error-msg" id={err('service')}>{errors.service}</p>}
          </div>
          <div className="field">
            <label htmlFor={id('date')}>Preferred date</label>
            <input id={id('date')} type="date" min={min} max={max} value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => blur('date')} aria-invalid={!!errors.date} aria-describedby={err('date')} required />
            {errors.date && <p className="error-msg" id={err('date')}>{errors.date}</p>}
          </div>
        </div>

        <div className="field">
          <span className="label" id={id('time-l')}>Available times</span>
          {!date && <p className="empty">Choose a date to see the open times.</p>}
          {date && loadingSlots && <div className="slots" aria-hidden>{Array.from({ length: 6 }, (_, i) => <span key={i} className="slot-skel" />)}</div>}
          {date && loadingSlots && <span className="sr-only" role="status">Loading available times</span>}
          {date && slotsFailed && (
            <p className="empty" role="alert">We could not load the times. <button type="button" className="link-btn" onClick={() => loadSlots(date)}>Try again</button></p>
          )}
          {date && avail && !loadingSlots && !avail.open && <p className="empty" role="status">{REASONS[avail.reason ?? 'closed']}</p>}
          {date && avail && !loadingSlots && avail.open && avail.slots.length === 0 && <p className="empty" role="status">{REASONS.fully_booked}</p>}
          {date && avail && !loadingSlots && avail.open && avail.slots.length > 0 && (
            <>
              <p className="branch-note" role="status"><strong>{avail.branch?.name}</strong> · {avail.branch?.address} · {avail.branch?.hours}</p>
              <div className="slots" role="radiogroup" aria-labelledby={id('time-l')} aria-describedby={err('time')}>
                {avail.slots.map((s) => (
                  <label key={s} className="slot">
                    <input type="radio" name={id('time')} value={s} checked={time === s} onChange={() => { setTime(s); setErrors((p) => ({ ...p, time: undefined })); }} />
                    <span>{formatTime(s)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          {errors.time && <p className="error-msg" id={err('time')}>{errors.time}</p>}
        </div>
      </fieldset>

      <fieldset className="group" disabled={submitting}>
        <legend>2 · Your details</legend>
        <div className="grid">
          <div className="field">
            <label htmlFor={id('name')}>Full name</label>
            <input id={id('name')} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => blur('name')} aria-invalid={!!errors.name} aria-describedby={err('name')} required />
            {errors.name && <p className="error-msg" id={err('name')}>{errors.name}</p>}
          </div>
          <div className="field">
            <label htmlFor={id('phone')}>Mobile number</label>
            <input id={id('phone')} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => blur('phone')} aria-invalid={!!errors.phone} aria-describedby={`${id('phone-h')} ${err('phone') ?? ''}`.trim()} required />
            <p className="hint" id={id('phone-h')}>For example 0917 123 4567. Used only for this booking.</p>
            {errors.phone && <p className="error-msg" id={err('phone')}>{errors.phone}</p>}
          </div>
        </div>
        <div className="field">
          <label htmlFor={id('email')}>Email <span className="muted">(optional, for a confirmation copy)</span></label>
          <input id={id('email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => blur('email')} aria-invalid={!!errors.email} aria-describedby={err('email')} />
          {errors.email && <p className="error-msg" id={err('email')}>{errors.email}</p>}
        </div>
      </fieldset>

      <div className="book-foot">
        <button className="btn btn-primary btn-lg" type="submit" disabled={submitting} onMouseDown={(e) => e.preventDefault() /* keep focus put so the field you are leaving does not re-flow the page under the click */}>
          {submitting ? 'Booking your visit…' : 'Confirm appointment'}
        </button>
        <p className="hint">Free to cancel or reschedule up to 24 hours before your visit.</p>
      </div>
    </form>
  );
}
