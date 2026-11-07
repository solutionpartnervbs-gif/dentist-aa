import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toCsv } from '../lib';
import { Logo } from '../components/Logo';
import { CLINIC } from '../config/clinic';

interface Appt {
  id: string;
  appointment_date: string;
  appointment_time: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  service_type: string;
  status: string;
}
interface Report {
  date: string; totalBookings: number; confirmed: number; completed: number; cancelled: number;
  servicesBreakdown: Record<string, number>;
}

export default function Admin() {
  // Token lives in memory only (never persisted).
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState<Report | null>(null);

  const api = useCallback(async <T,>(path: string, init: RequestInit = {}, t = token): Promise<T> => {
    const res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${t}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (res.status === 401) { setAuthed(false); throw new Error('Unauthorized — check the admin password.'); }
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json() as Promise<T>;
  }, [token]);

  const load = useCallback(async (t = token) => {
    const p = new URLSearchParams();
    if (date) p.set('date', date);
    if (status) p.set('status', status);
    if (q.trim()) p.set('q', q.trim());
    try {
      const d = await api<{ appointments: Appt[] }>(`/api/admin/appointments?${p}`, {}, t);
      setAppts(d.appointments ?? []);
      setAuthed(true);
      setMsg('');
    } catch (e) { setMsg((e as Error).message); }
  }, [api, date, status, q, token]);

  const setApptStatus = async (id: string, s: 'completed' | 'cancelled') => {
    if (s === 'cancelled' && !confirm('Cancel this appointment slot?')) return;
    try { await api(`/api/admin/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: s }) }); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  const count = (s: string) => appts.filter((a) => a.status === s).length;

  const exportCsv = () => {
    if (!appts.length) return setMsg('No appointments loaded to export.');
    const csv = toCsv([['ID', 'Date', 'Time', 'Patient', 'Phone', 'Email', 'Service', 'Status'],
      ...appts.map((a) => [a.id, a.appointment_date, a.appointment_time, a.patient_name, a.patient_phone, a.patient_email, a.service_type, a.status])]);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${CLINIC.csvPrefix}-appointments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <main className="admin login">
        <form className="card" onSubmit={(e) => { e.preventDefault(); void load(token); }}>
          <Logo height={52} />
          <h1>Staff portal</h1>
          <label htmlFor="pw">Admin password</label>
          <input id="pw" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="current-password" required />
          <button className="btn btn-primary">Sign in</button>
          <p className="small" role="alert">{msg}</p>
          <Link to="/" className="small">← Patient site</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="admin-head">
        <h1>Appointments</h1>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={async () => { try { const r = await api<{ report: Report }>(`/api/admin/reports${date ? `?date=${date}` : ''}`); setReport(r.report); } catch (e) { setMsg((e as Error).message); } }}>Daily report</button>
          <button className="btn btn-ghost" onClick={async () => { if (!confirm('Send reminders for tomorrow?')) return; try { const r = await api<{ reminded: number; date: string }>('/api/admin/reminders/send', { method: 'POST' }); setMsg(`Reminders sent: ${r.reminded} patient(s) for ${r.date}.`); } catch (e) { setMsg((e as Error).message); } }}>Send reminders</button>
          <button className="btn btn-ghost" onClick={exportCsv}>Export CSV</button>
        </div>
      </header>
      <div className="stats">
        {[['Total', appts.length], ['Confirmed', count('confirmed')], ['Completed', count('completed')], ['Cancelled', count('cancelled')]].map(([l, v]) => (
          <div className="card stat" key={l as string}><span className="muted small">{l}</span><strong>{v}</strong></div>
        ))}
      </div>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <label className="sr-only" htmlFor="f-date">Date</label><input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="sr-only" htmlFor="f-status">Status</label>
        <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option>
        </select>
        <label className="sr-only" htmlFor="f-q">Search</label><input id="f-q" placeholder="Name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary">Apply</button>
      </form>
      <p className="small" role="status">{msg}</p>
      <ul className="appt-list">
        {appts.length === 0 && <li className="card muted">No matching appointments found.</li>}
        {appts.map((a) => (
          <li className="card appt" key={a.id}>
            <div><strong>{a.appointment_date}</strong> · {a.appointment_time}</div>
            <div>{a.patient_name} <span className="muted">· {a.patient_phone}</span></div>
            <div className="muted">{a.service_type}</div>
            <span className={`badge badge-${a.status}`}>{a.status}</span>
            <div className="row-gap">
              <a className="btn btn-ghost sm" href={`/receipt/${a.id}`} target="_blank" rel="noopener noreferrer">Receipt</a>
              {a.status === 'confirmed' && (<>
                <button className="btn btn-ghost sm" onClick={() => void setApptStatus(a.id, 'completed')}>✓ Done</button>
                <button className="btn btn-danger sm" onClick={() => void setApptStatus(a.id, 'cancelled')}>✕ Cancel</button>
              </>)}
            </div>
          </li>
        ))}
      </ul>
      {report && (
        <div className="modal-backdrop" onClick={() => setReport(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Daily report" onClick={(e) => e.stopPropagation()}>
            <h2>Report — {report.date}</h2>
            <p>Total: <strong>{report.totalBookings}</strong> · Confirmed {report.confirmed} · Completed {report.completed} · Cancelled {report.cancelled}</p>
            <h3>Service breakdown</h3>
            <ul>{Object.entries(report.servicesBreakdown ?? {}).map(([k, v]) => <li key={k}>{k}: <strong>{v}</strong></li>)}</ul>
            <button className="btn btn-primary" autoFocus onClick={() => setReport(null)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}
