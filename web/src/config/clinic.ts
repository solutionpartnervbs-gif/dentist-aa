/**
 * PERSONALISATION POINT 1 of 3 — everything a visitor reads about the clinic.
 * To brand the site for a new client, edit this file, `tokens.css` (colours) and `index.html` (page title/meta).
 * See docs/NEW-CLIENT.md for the full checklist (including the few backend strings).
 */
export const CLINIC = {
  name: 'Suyat Dental Clinic',
  shortName: 'Suyat',
  wordmark: 'Suyat',               // script wordmark in the Logo component
  descriptor: 'DENTAL CLINIC',     // small caps line under the wordmark
  domain: 'suyatdental.com',
  tagline: 'Comprehensive Dental Care for a Healthier, Brighter Smile',
  badge: 'After-Hours Appointments Available',
  headlineLead: 'Comprehensive',
  headlineAccent: 'Dental Care',
  heroSubhead: 'for a Healthier, Brighter Smile',
  heroLead: 'for a healthier, brighter smile. Book your appointment online in minutes.',
  assistantName: 'Milky',
  assistantIcon: '/images/chatbot-icon.webp',
  assistantIconSmall: '/images/chatbot-icon-small.webp',
  welcome:
    'Hi! I’m Milky, your dental helper. I can answer questions about our hours, branches and services, and help you book, reschedule or cancel an appointment. What can I do for you?',
  sessionKey: 'suyat_session_id',  // localStorage key for the chat session
  csvPrefix: 'suyat',              // admin CSV export file name prefix
} as const;

export interface Service {
  /** Value sent to the booking API (must match BOOKABLE_SERVICES on the server). */
  id: string;
  title: string;
  blurb: string;
  /** Photo shown on the service card. */
  image: string;
  imageAlt: string;
}

export const SERVICES: Service[] = [
  { id: 'cleaning', title: 'Cleaning & checkups', blurb: 'Routine examinations and preventive dental care.', image: '/images/services/cleaning.webp', imageAlt: 'A healthy white tooth surrounded by a sparkling ring' },
  { id: 'filling', title: 'Restorations', blurb: 'Discuss fillings and other restorative treatment options.', image: '/images/services/restorations.webp', imageAlt: 'A tooth with a gold crown' },
  { id: 'braces', title: 'Braces & consultations', blurb: 'Explore orthodontic care and consultation options.', image: '/images/services/braces.webp', imageAlt: 'A dentist showing a patient a dental X-ray on a tablet' },
  { id: 'whitening', title: 'Teeth whitening', blurb: 'Ask the dental team about whitening options.', image: '/images/services/whitening.webp', imageAlt: 'A smile shown before and after whitening' },
  { id: 'extraction', title: 'Extractions', blurb: 'Consult the clinic about extraction and surgical care.', image: '/images/services/extractions.webp', imageAlt: 'Dental forceps lifting a tooth from the gum' },
  { id: 'urgent dental concern', title: 'Dental concerns', blurb: 'Contact the clinic directly for urgent dental needs.', image: '/images/services/concerns.webp', imageAlt: 'A tooth with a red glow showing pain' },
];

export const STEPS = [
  { n: '01', title: 'Choose your visit', text: 'Pick the service you need and a date. We show the open times for the branch that day.' },
  { n: '02', title: 'Enter your details', text: 'Give us your name and mobile number so our team can reach you about your visit.' },
  { n: '03', title: 'Get your confirmation', text: 'You receive a booking reference and a printable proof of appointment right away.' },
] as const;

export interface Branch {
  id: string;
  name: string;
  address: string;
  days: string;
  hours: string;
  mapQuery: string;
}

export const BRANCHES: Branch[] = [
  {
    id: 'san-nicolas',
    name: 'San Nicolas, Pangasinan',
    address: 'Sta. Maria West, San Nicolas, Pangasinan',
    days: 'Monday – Tuesday',
    hours: '9:00 AM – 6:00 PM',
    mapQuery: 'Sta. Maria West, San Nicolas, Pangasinan',
  },
  {
    id: 'project-6',
    name: 'Project 6, Quezon City',
    address: '111 – B2 Rd 3 Cor. Road 7, Project 6, Quezon City',
    days: 'Wednesday – Saturday',
    hours: '10:00 AM – 6:00 PM',
    mapQuery: '111 B2 Road 3 corner Road 7, Project 6, Quezon City',
  },
];

export const QUICK_CHIPS = [
  'I want to book a cleaning',
  'What are your clinic hours?',
  'What slots are open tomorrow?',
] as const;
