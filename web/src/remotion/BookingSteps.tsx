import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, FONT_DISPLAY } from './theme';
import { STEPS } from '../config/clinic';

export const BOOKING_DURATION = 210;

export const BookingSteps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const u = width / 1080;
  const blob = spring({ frame, fps, config: { damping: 20 } });
  const phone = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  const notif = spring({ frame: frame - 35, fps, config: { damping: 11 } });
  const typed = 'Book a cleaning tomorrow 10:00';
  const chars = Math.floor(interpolate(frame, [80, 130], [0, typed.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const confirmed = spring({ frame: frame - 150, fps, config: { damping: 10 } });

  return (
    <AbsoluteFill style={{ background: '#f4f6f2', fontFamily: FONT, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -200 * u, top: -160 * u, width: 820 * u, height: 820 * u, borderRadius: '50%', background: C.orange, opacity: 0.9 * blob, transform: `scale(${blob})` }} />
      <div
        style={{
          position: 'absolute', left: 70 * u, top: 150 * u, width: 400 * u, height: 800 * u, borderRadius: 56 * u,
          background: '#222', padding: 14 * u, boxShadow: '0 30px 60px rgba(0,0,0,.3)',
          transform: `translateY(${interpolate(phone, [0, 1], [200, 0])}px)`, opacity: phone,
        }}
      >
        <div style={{ width: '100%', height: '100%', borderRadius: 44 * u, background: `linear-gradient(180deg, #dff4fa, #fff)`, position: 'relative', overflow: 'hidden', padding: 22 * u }}>
          <div style={{ fontSize: 84 * u, textAlign: 'center', marginTop: 40 * u }}>🦷</div>
          <div
            style={{
              marginTop: 30 * u, background: '#fff', borderRadius: 24 * u, padding: 22 * u, boxShadow: '0 12px 30px rgba(27,42,73,.18)',
              textAlign: 'center', opacity: notif, transform: `scale(${interpolate(notif, [0, 1], [0.6, 1])})`,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 28 * u, color: C.navy }}>Reminder</div>
            <div style={{ fontSize: 24 * u, color: C.navy, marginTop: 6 * u }}>Book your appointment with us!</div>
          </div>
          <div style={{ position: 'absolute', left: 22 * u, right: 22 * u, bottom: 90 * u, background: C.cyan, color: '#fff', borderRadius: 22 * u, padding: `${14 * u}px ${18 * u}px`, fontSize: 22 * u, minHeight: 28 * u, opacity: chars > 0 ? 1 : 0 }}>
            {typed.slice(0, chars)}
            {chars < typed.length && chars > 0 ? '▍' : ''}
          </div>
          <div style={{ position: 'absolute', left: 22 * u, right: 22 * u, bottom: 22 * u, background: '#fff', border: `2px solid ${C.cyan}`, color: C.navy, borderRadius: 22 * u, padding: `${12 * u}px ${18 * u}px`, fontWeight: 700, fontSize: 22 * u, opacity: confirmed, transform: `translateY(${interpolate(confirmed, [0, 1], [30, 0])}px)` }}>
            ✅ Booking confirmed!
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 540 * u, top: 150 * u, width: 480 * u }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 40 * u, color: C.navy, lineHeight: 1.15, opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' }) }}>
          Schedule in just a few easy steps
        </div>
        {STEPS.map((s, i) => {
          const p = spring({ frame: frame - 50 - i * 30, fps, config: { damping: 14 } });
          return (
            <div key={s.n} style={{ display: 'flex', gap: 22 * u, marginTop: 50 * u, opacity: p, transform: `translateX(${interpolate(p, [0, 1], [60, 0])}px)` }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 34 * u, color: C.red }}>{s.n}</div>
              <div style={{ fontSize: 30 * u, color: C.navy, lineHeight: 1.3 }}>{s.text}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
