import type { CSSProperties } from 'react';
import { TOOTH_PATH } from '../remotion/theme';
import { CLINIC } from '../config/clinic';

/**
 * Suyat brand lockup (tooth mark + script wordmark) as live SVG/text so it works on any background.
 * Shared by the site and the Remotion compositions. Swap for the official transparent logo when available.
 */
export function Logo({ height = 48, light = false, style }: { height?: number; light?: boolean; style?: CSSProperties }) {
  // Follow the site theme: navy on light backgrounds, near-white on dark ones. The fallbacks matter where the page's
  // CSS variables do not exist (the Remotion video compositions). `light` forces white for fixed dark backgrounds.
  const ink = light ? '#ffffff' : 'var(--text, #1b2a49)';
  const sub = light ? '#cfeef7' : 'var(--text-muted, #4d5d78)';
  return (
    <span
      role="img"
      aria-label={CLINIC.name}
      style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.18, height, lineHeight: 1, ...style }}
    >
      <svg viewBox="0 0 64 64" height={height} width={height} aria-hidden>
        <defs>
          <linearGradient id="sy-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ea2825" />
            <stop offset="1" stopColor="#00b4d8" />
          </linearGradient>
        </defs>
        <path d={TOOTH_PATH} fill="none" stroke="url(#sy-g)" strokeWidth={5} strokeLinejoin="round" />
      </svg>
      <span style={{ display: 'inline-flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive", fontWeight: 700, fontSize: height * 0.7, color: ink }}>{CLINIC.wordmark}</span>
        <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, fontSize: height * 0.2, letterSpacing: '0.18em', color: sub }}>{CLINIC.descriptor}</span>
      </span>
    </span>
  );
}
