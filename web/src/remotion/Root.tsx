import React from 'react';
import { Composition } from 'remotion';
import { HeroReel, HERO_DURATION } from './HeroReel';
import { ServicesShowcase, SERVICES_DURATION } from './ServicesShowcase';
import { BookingSteps, BOOKING_DURATION } from './BookingSteps';
import { ReceptionistWave, WAVE_DURATION } from './ReceptionistWave';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HeroReel" component={HeroReel} durationInFrames={HERO_DURATION} fps={30} width={1280} height={720} />
    <Composition id="HeroReelVertical" component={HeroReel} durationInFrames={HERO_DURATION} fps={30} width={1080} height={1350} />
    <Composition id="ServicesShowcase" component={ServicesShowcase} durationInFrames={SERVICES_DURATION} fps={30} width={1280} height={720} />
    <Composition id="BookingSteps" component={BookingSteps} durationInFrames={BOOKING_DURATION} fps={30} width={1080} height={1080} />
    <Composition id="ReceptionistWave" component={ReceptionistWave as unknown as React.FC<Record<string, unknown>>} durationInFrames={WAVE_DURATION} fps={30} width={800} height={160} defaultProps={{ state: 'idle' as const }} />
  </>
);
