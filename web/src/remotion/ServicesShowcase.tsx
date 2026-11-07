import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, FONT_DISPLAY } from './theme';
import { SERVICES } from '../config/clinic';

export const SERVICES_DURATION = 180;

export const ServicesShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const u = width / 1280;
  const title = spring({ frame, fps, config: { damping: 14 } });
  const active = Math.floor(interpolate(frame, [40, 170], [0, SERVICES.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })) % SERVICES.length;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.mist}, #fff)`, fontFamily: FONT, padding: 56 * u }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 52 * u, color: C.navy, opacity: title, transform: `translateY(${interpolate(title, [0, 1], [30, 0])}px)` }}>
        Everything for your smile
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 * u, marginTop: 36 * u }}>
        {SERVICES.map((s, i) => {
          const p = spring({ frame: frame - 12 - i * 8, fps, config: { damping: 13, stiffness: 120 } });
          const on = i === active && frame >= 40;
          return (
            <div
              key={s.id}
              style={{
                background: '#fff',
                borderRadius: 28 * u,
                padding: 28 * u,
                boxShadow: on ? `0 18px 40px ${C.cyan}55` : '0 8px 24px rgba(27,42,73,.08)',
                border: `3px solid ${on ? C.cyan : 'transparent'}`,
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [50, 0])}px) scale(${on ? 1.04 : 1})`,
                transition: 'none',
              }}
            >
              <Img src={staticFile(s.image.replace(/^\//, ''))} style={{ width: 120 * u, height: 104 * u, objectFit: 'cover', borderRadius: 18 * u }} />
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 28 * u, color: C.navy, marginTop: 10 * u }}>
                <span style={{ color: C.red, marginRight: 8 * u, fontStyle: 'italic' }}>0{i + 1}</span>
                {s.title}
              </div>
              <div style={{ fontSize: 19 * u, color: '#4d5d78', marginTop: 8 * u, lineHeight: 1.4 }}>{s.blurb}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
