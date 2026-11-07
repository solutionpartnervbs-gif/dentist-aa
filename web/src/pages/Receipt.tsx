import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Logo } from '../components/Logo';

interface Receipt {
  referenceNumber: string;
  patientName: string;
  patientPhone: string;
  serviceType: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  branch: string;
  branchAddress: string;
  instructions: string[];
}

export default function ReceiptPage() {
  const { id = '' } = useParams();
  const [r, setR] = useState<Receipt | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetch(`/api/appointments/${encodeURIComponent(id)}/receipt`)
      .then(async (res) => {
        if (res.status === 404) return alive && setState('missing');
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Receipt;
        if (alive) { setR(data); setState('ok'); }
      })
      .catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [id]);

  return (
    <main className="receipt-page">
      <div className="receipt card">
        <Logo height={56} />
        {state === 'loading' && <p role="status">Loading your receipt…</p>}
        {state === 'missing' && <p role="alert">We couldn’t find that appointment. Please check your link or contact the clinic.</p>}
        {state === 'error' && <p role="alert">Something went wrong loading the receipt. Please try again.</p>}
        {state === 'ok' && r && (
          <>
            <h1>Proof of appointment</h1>
            <p className="ref">{r.referenceNumber}</p>
            <dl>
              <dt>Patient</dt><dd>{r.patientName}</dd>
              <dt>Phone</dt><dd>{r.patientPhone}</dd>
              <dt>Service</dt><dd>{r.serviceType}</dd>
              <dt>Date</dt><dd>{r.appointmentDate}</dd>
              <dt>Time</dt><dd>{r.appointmentTime}</dd>
              <dt>Status</dt><dd><span className={`badge badge-${r.status}`}>{r.status}</span></dd>
              <dt>Branch</dt><dd>{r.branch}<br /><span className="muted">{r.branchAddress}</span></dd>
            </dl>
            {r.instructions?.length > 0 && (
              <>
                <h2>Before your visit</h2>
                <ul>{r.instructions.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </>
            )}
            <div className="no-print row-gap">
              <button className="btn btn-primary" onClick={() => window.print()}>Print / save</button>
              <Link className="btn btn-ghost" to="/">Back to site</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
