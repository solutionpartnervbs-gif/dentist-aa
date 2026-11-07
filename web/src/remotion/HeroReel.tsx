import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, FONT_DISPLAY } from './theme';
import { Logo } from '../components/Logo';
import { CLINIC } from '../config/clinic';

export const HERO_DURATION = 150;

const Word: React.FC<{ text: string; delay: number; color?: string; italic?: boolean }> = ({ text, delay, color = C.navy, italic }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 110 } });
  return (
    <span
      style={{
        display: 'inline-block',
        marginRight: '0.25em',
        color,
        fontStyle: italic ? 'italic' : 'normal',
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
      }}
    >
      {text}
    </span>
  );
};

export const HeroReel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const logo = spring({ frame, fps, config: { damping: 12 } });
  const badge = spring({ frame: frame - 85, fps, config: { damping: 12 } });
  const underline = interpolate(frame, [60, 95], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const photo = spring({ frame: frame - 30, fps, config: { damping: 16 } });
  const u = vertical ? width / 1080 : width / 1280;

  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, #ffffff 0%, ${C.mist} 55%, #c9eef7 100%)`, fontFamily: FONT, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 520 * u, height: 520 * u, borderRadius: '50%', right: -120 * u, top: -140 * u, background: `radial-gradient(circle, ${C.cyan}55, transparent 70%)` }} />
      <div style={{ position: 'absolute', width: 380 * u, height: 380 * u, borderRadius: '50%', left: -100 * u, bottom: -120 * u, background: `radial-gradient(circle, ${C.red}33, transparent 70%)` }} />

      <div style={{ position: 'absolute', left: 56 * u, top: 40 * u, opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.8, 1])})`, transformOrigin: 'left center'  }}><Logo height={84 * u} /></div>

      <div style={{ position: 'absolute', left: 56 * u, top: (vertical ? 190 : 190) * u, width: (vertical ? 960 : 640) * u, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: (vertical ? 108 : 78) * u, lineHeight: 1.02 }}>
        <Word text={CLINIC.headlineLead} delay={8} />
        <br />
        {CLINIC.headlineAccent.split(' ').map((w, i) => (
          <Word key={w + i} text={w} delay={16 + i * 6} />
        ))}
        <div style={{ height: 6 * u, width: `${underline}%`, maxWidth: 560 * u, marginTop: 14 * u, borderRadius: 6, background: `linear-gradient(90deg, ${C.red}, ${C.cyan})` }} />
        <div style={{ fontSize: (vertical ? 50 : 36) * u, fontWeight: 500, fontStyle: 'italic', marginTop: 20 * u, color: C.navy, opacity: interpolate(frame, [50, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          {CLINIC.heroSubhead}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: (vertical ? 80 : 60) * u,
          bottom: (vertical ? 120 : 80) * u,
          width: (vertical ? 620 : 470) * u,
          height: (vertical ? 520 : 400) * u,
          borderRadius: 36 * u,
          overflow: 'hidden',
          boxShadow: '0 30px 60px rgba(27,42,73,.25)',
          opacity: photo,
          transform: `translateY(${interpolate(photo, [0, 1], [60, 0])}px) rotate(${interpolate(photo, [0, 1], [4, 0])}deg)`,
        }}
      >
        <Img src={staticFile('images/dentist-thumbs-up.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>


      <div
        style={{
          position: 'absolute',
          left: 56 * u,
          bottom: (vertical ? 70 : 60) * u,
          padding: `${16 * u}px ${28 * u}px`,
          borderRadius: 999,
          background: C.navy,
          color: '#fff',
          fontWeight: 700,
          fontSize: (vertical ? 36 : 26) * u,
          boxShadow: `0 0 0 ${5 * u}px ${C.cyan}66`,
          opacity: badge,
          transform: `scale(${interpolate(badge, [0, 1], [0.7, 1])})`,
          transformOrigin: 'left center',
        }}
      >
        🕒 {CLINIC.badge}
      </div>
    </AbsoluteFill>
  );
};
