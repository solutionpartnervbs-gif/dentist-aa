import {
  bookAppointment,
  cancelAppointment,
  checkAvailableSlots,
  queryAppointments,
  rescheduleAppointment,
  getAppointmentReceipt,
  generateClinicReport,
} from './tools.js';
import { BRANCHES } from './db.js';
import { converse, cleanDraft, type BookedSummary, type Draft } from './converse.js';
import { allIsoDates, parseDate, parsePhone, parseService, parseTime, toSpeech } from './nlu.js';

export type { BookedSummary, Draft };

function manilaDatePlus(days: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const base = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')));
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

export interface ChatResult {
  reply: string;
  /** The same reply rewritten to sound right when read aloud (no ISO dates, 24h times, links, markdown, emoji). */
  speech: string;
  booked?: BookedSummary;
  /** Conversation state to send back with the next message (null/absent = no conversation in progress). */
  draft?: Draft | null;
  /** Hints for the web page (not shown to the visitor), e.g. make Milky wave. */
  client?: { findMilky?: boolean };
}

const BRANCHES_TEXT =
  'We have two branches: ' +
  BRANCHES.map((b) => `${b.name.replace(' Branch', '')} (${b.address}), open ${b.daysLabel.replace('-', ' to ')}, ${b.hoursLabel.replace(' - ', ' to ')}`).join(', and ') +
  '. We are closed on Sundays. After-hours appointments are available by prior arrangement.';
const SERVICES_TEXT =
  'We offer cleaning and checkups, restorations such as fillings, braces and consultations, teeth whitening, extractions, and urgent dental care. I can book any of these for you. I don\'t have prices to quote, our team will explain costs at your visit.';

async function route(
  db: D1Database,
  message: string,
  draftIn: Draft | null,
  today: string,
): Promise<Omit<ChatResult, 'speech'>> {
  const text = message.trim();
  const lower = text.toLowerCase();
  const phone = parsePhone(text);
  const time = parseTime(text);
  const dates = allIsoDates(text);

  // Mid-conversation: keep going unless the caller clearly switched to another task.
  const switched = /reschedule|re-schedule|\breceipt\b|\bproof\b|\bstatus\b|\bcancel\b|\b(report|clinic stats)\b/.test(lower);
  if (draftIn && !(switched && !/^\s*cancel that/.test(lower))) {
    const r = await converse(db, text, draftIn, today);
    return r;
  }

  // 1. Reschedule intent
  if (/reschedule|move (my )?appointment|change (my )?appointment|re-schedule/.test(lower)) {
    return converse(db, text, null, today, 'reschedule');
  }

  // Cancellation (before status: "cancel my appointment" must not be read as a status check)
  if (/\bcancel\b/.test(lower)) {
    return converse(db, text, null, today, 'cancel');
  }

  // 2. Receipt / Proof of Appointment intent
  if (/receipt|proof|ticket|slip|confirmation card/.test(lower)) {
    if (!phone) {
      return {
        reply:
          'To retrieve your official appointment receipt or proof of booking, please provide your registered phone number. Example: "Send receipt for 09170000001".',
      };
    }
    const appts = await queryAppointments(db, { patientPhone: phone });
    const target = appts.find((a) => a.status === 'confirmed') || appts[0];
    if (!target) {
      return {
        reply: `No appointments found on file for phone ${phone}. You can book a new appointment anytime!`,
      };
    }
    const receipt = await getAppointmentReceipt(db, target.id);
    if (!receipt) {
      return { reply: 'Could not generate receipt at this time.' };
    }
    return {
      reply:
        `📄 **Official Proof of Appointment**\n` +
        `• Ref: ${receipt.referenceNumber}\n` +
        `• Patient: ${receipt.patientName}\n` +
        `• Service: ${receipt.serviceType}\n` +
        `• Date & Time: ${receipt.appointmentDate} at ${receipt.appointmentTime}\n` +
        `• Branch: ${receipt.branch} (${receipt.branchAddress})\n` +
        `• Status: ${receipt.status.toUpperCase()}\n` +
        `View & print digital receipt: ${receipt.receiptUrl}`,
    };
  }

  // 3. Status check / appointment query
  if (/status|my appointment|check appointment|existing booking|do i have/.test(lower)) {
    if (!phone) {
      return {
        reply:
          'Please send your registered phone number to check your appointment status. Example: "Check appointment 09170000001".',
      };
    }
    const appts = await queryAppointments(db, { patientPhone: phone });
    if (appts.length === 0) {
      return {
        reply: `No appointments found for ${phone}. Reply with "What slots are open tomorrow?" to book a visit.`,
      };
    }
    const list = appts
      .map(
        (a) =>
          `• ${a.appointment_date} at ${a.appointment_time} (${a.service_type}) — Status: ${a.status} [Receipt: /receipt.html?id=${a.id}]`,
      )
      .join('\n');
    return {
      reply: `Here are your appointment records for ${phone}:\n${list}`,
    };
  }

  // 4. Reports / Clinic analytics intent
  if (/\b(report|clinic stats|analytics summary|daily digest)\b/.test(lower)) {
    const targetDate = dates[0];
    const rep = await generateClinicReport(db, targetDate ? { date: targetDate } : {});
    const breakdown = Object.entries(rep.servicesBreakdown)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return {
      reply:
        `📊 **Clinic Appointment Report (${rep.date})**\n` +
        `• Total Bookings: ${rep.totalBookings}\n` +
        `• Confirmed: ${rep.confirmed} | Completed: ${rep.completed} | Cancelled: ${rep.cancelled}\n` +
        `• Services: ${breakdown || 'None yet'}\n` +
        `Open admin portal at /admin.html for full records.`,
    };
  }

  const bookingWords = /\b(book|reserve|appointment|schedule|set up|i (?:want|need|would like|'d like)|can i (?:get|have))\b/.test(lower);
  const service = parseService(text);
  const singleDate = dates[0] || parseDate(text, today);

  // Small talk: greetings, who are you, and "where is Milky?" (checked before the location FAQ, which also matches "where")
  if (!bookingWords && !service) {
    if (/\bmilky\b/.test(lower) && /\b(where|find|see|missing|gone|hiding|hide|disappear|vanish|lost)\b/.test(lower)) {
      return {
        reply:
          "I'm right here! I'm Milky, the little tooth that follows you down the page. Look for me near the edge of your screen, or tap me anytime to chat. I'll wave so you can spot me.",
        client: { findMilky: true },
      };
    }
    if (/\b(who|what) are you\b|\byour name\b|\bwho is milky\b|\bwhat is milky\b/.test(lower)) {
      return {
        reply:
          "I'm Milky, the virtual assistant of Suyat Dental Clinic. I can help you book, reschedule or cancel an appointment and answer questions about our hours, branches and services. I'm a computer program, so for anything medical please talk to our dental team.",
      };
    }
    if (/^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|mabuhay|kumusta|kamusta)\b/.test(lower) && lower.split(/\s+/).length <= 5) {
      const g = lower.match(/good (morning|afternoon|evening)/)?.[0];
      return {
        reply:
          `${g ? g[0].toUpperCase() + g.slice(1) : 'Hi there'}! I'm Milky, your dental helper. I'm trying to help you book a visit or find answers. Would you like to book an appointment, see open times, or check our hours?`,
      };
    }
  }

  // 6. Slots check
  if (/avail|slot|\bopen\b|\bfree\b/.test(lower) && !time && !bookingWords && !service) {
    if (!singleDate) {
      return {
        reply: 'Which date should I check? You can say tomorrow, next Monday, or a date like November 20th.',
        draft: { intent: 'book', awaiting: 'date' },
      };
    }
    const slots = await checkAvailableSlots(db, singleDate);
    return {
      reply:
        slots.length > 0
          ? `Open slots on ${singleDate}: ${slots.join(', ')}. Reply with a time plus your name and phone to book.`
          : `Sorry, ${singleDate} is fully booked or closed. Please try another date.`,
    };
  }

  // 7. Questions about the clinic
  if (/\b(hours?|open(?:ing)?|close|closing|what time|when are you)\b/.test(lower) && !bookingWords) {
    return { reply: BRANCHES_TEXT + ' Would you like me to book you in?' };
  }
  if (/\b(where|location|address|branch(?:es)?|direction|near me|find you)\b/.test(lower) && !bookingWords) {
    return { reply: BRANCHES_TEXT };
  }
  if (/\b(services?|offer|what do you do|price|prices|cost|how much|rates?)\b/.test(lower) && !bookingWords) {
    return { reply: SERVICES_TEXT };
  }
  if (/^\s*(thanks?|thank you|salamat|ok(?:ay)? thanks?)\b/.test(lower)) {
    return { reply: "You're welcome! Is there anything else I can help you with?" };
  }

  // 8. Booking (conversational)
  if (bookingWords || service || (time && phone)) {
    return converse(db, text, null, today, 'book');
  }

  return {
    reply:
      "Hi! I'm Milky, the Suyat Dental Clinic virtual assistant. I can:\n" +
      '• Book an appointment (just say "I want a cleaning next Monday at 2 PM")\n' +
      '• Check open times ("What slots are open tomorrow?")\n' +
      '• Reschedule or cancel a visit\n' +
      '• Send your proof of appointment ("Send receipt for 09170000001")\n' +
      '• Tell you our hours, branches and services',
  };
}

export async function handleChatMessage(
  db: D1Database,
  message: string,
  draft?: unknown,
  today: string = manilaDatePlus(0),
): Promise<ChatResult> {
  const r = await route(db, message, cleanDraft(draft), today);
  return { ...r, speech: toSpeech(r.reply) };
}

