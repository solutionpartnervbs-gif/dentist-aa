import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './theme';

export type WaveState = 'idle' | 'listening' | 'speaking';
export interface WaveProps {
  state: WaveState;
}
export const WAVE_DURATION = 60;
const BARS = 32;

export const ReceptionistWave: React.FC<WaveProps> = ({ state }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const amp = state === 'idle' ? 0.12 : state === 'listening' ? 0.5 : 0.9;
  const speed = state === 'speaking' ? 3 : 1.6;
  const color = state === 'listening' ? C.red : C.cyan;
  const gap = width / BARS;
  return (
    <AbsoluteFill style={{ background: 'transparent' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        {Array.from({ length: BARS }, (_, i) => {
          // frame loops every WAVE_DURATION: use integer multiples so the loop is seamless
          const t = ((frame / WAVE_DURATION) * Math.PI * 2 * Math.round(speed)) + i * 0.55;
          const h = height * (0.1 + amp * 0.8 * Math.abs(Math.sin(t) * Math.cos(i * 0.31)));
          return <rect key={i} x={i * gap + gap * 0.2} y={(height - h) / 2} width={gap * 0.6} height={h} rx={gap * 0.3} fill={color} opacity={0.4 + 0.6 * (h / height)} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
