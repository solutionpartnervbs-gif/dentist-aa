/**
 * Everything Milky says in its speech bubbles. Plain text, edit freely when re-branding for another clinic.
 * No medical advice anywhere: Milky books appointments and points people to the dental team.
 */
export const DIALOGUE = {
  /** Said once per visit when the page loads. */
  greeting: (hour: number): string =>
    `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}! I’m Milky, your dental helper.`,
  /** Said a few seconds after the greeting. */
  trying: 'I’m trying to help you book a visit. Tap me anytime if you have a question.',
  /** Suggestions as the visitor reaches each part of the page (once each per visit). */
  suggestions: {
    services: 'Not sure what you need? A cleaning & checkup is a great first visit.',
    book: 'Pick a service and a date, and I’ll show you the open times.',
    how: 'It only takes three steps, and you get a booking reference right away.',
    branches: 'Two branches to choose from. I’ll show the right one for the day you pick.',
  } as Record<string, string>,
  /** Reactions while the visitor fills in the booking form. */
  form: {
    service: (label: string) => `Good choice: ${label}. Now pick a date.`,
    closed: 'We’re closed that day. Try another date and I’ll find open times.',
    full: 'That day is fully booked. Try the next one?',
    slots: (branch: string) => `These times are open at our ${branch}. Tap one to select it.`,
    help: (problem: string) => `Let me help: ${problem}`,
    success: 'All set! Your appointment is booked. See you soon!',
    failed: 'Something went wrong on my side. Let’s try that again.',
  },
  /** When someone asks where Milky is, or taps "Where’s Milky?". */
  here: 'Here I am! 👋 Tap me to chat.',
} as const;
