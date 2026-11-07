import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';

const Admin = lazy(() => import('./pages/Admin'));
const ReceiptPage = lazy(() => import('./pages/Receipt'));

export default function App() {
  return (
    <Suspense fallback={<p role="status" style={{ padding: 24 }}>Loading…</p>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/receipt/:id" element={<ReceiptPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  );
}
