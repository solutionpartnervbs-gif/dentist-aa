import { handleChatMessage } from './chat.js';
import { getAppointmentReceipt } from './tools.js';
import type { Env } from './server.js';

export interface CallWebhookInput {
  CallSid?: string;
  From?: string;
  To?: string;
  SpeechResult?: string;
  Digits?: string;
  message?: string;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatSpokenDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const month = months[m - 1] || 'January';
    const ordinals = ['th', 'st', 'nd', 'rd'];
    const v = d % 100;
    const ord = ordinals[(v - 20) % 10] || ordinals[v] || ordinals[0];
    return `${month} ${d}${ord} ${y}`;
  } catch {
    return dateStr;
  }
}


export async function handleIncomingCall(
  request: Request,
  env: Env,
): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';
  let fromNumber = '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    fromNumber = params.get('From') || '';
  } else if (contentType.includes('application/json')) {
    try {
      const data = (await request.json()) as CallWebhookInput;
      fromNumber = data.From || '';
    } catch {
      // ignore
    }
  }

  const welcomeText =
    'Mabuhay! Welcome to Suyat Dental Clinic. I am your 24/7 AI dental assistant. ' +
    'I can check available slots, book an appointment, reschedule, or send you an official proof of appointment. ' +
    'Please tell me what you would like to do after the tone.';

  // TwiML response for Twilio / standard SIP carriers
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${escapeXml(welcomeText)}</Say>
  <Gather input="speech" action="/api/calls/process" method="POST" timeout="5" speechTimeout="auto" language="en-US">
    <Say voice="Polly.Joanna">I am listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">We did not receive any input. Goodbye!</Say>
</Response>`;

  if (contentType.includes('application/json')) {
    return Response.json({
      message: welcomeText,
      action: 'gather_speech',
      nextUrl: '/api/calls/process',
      caller: fromNumber,
    });
  }

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

export async function handleCallProcess(
  request: Request,
  env: Env,
): Promise<Response> {
  const contentType = request.headers.get('content-type') || '';
  let speech = '';
  let caller = '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    speech = params.get('SpeechResult') || params.get('Digits') || '';
    caller = params.get('From') || '';
  } else if (contentType.includes('application/json')) {
    try {
      const data = (await request.json()) as CallWebhookInput;
      speech = data.SpeechResult || data.message || '';
      caller = data.From || '';
    } catch {
      // ignore
    }
  }

  if (!speech.trim()) {
    const noInputTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">I could not hear your response. You can visit our patient portal at suyatdental.com. Goodbye!</Say>
</Response>`;
    return new Response(noInputTwiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }

  // Prepend caller number if speech mentions booking without a phone number
  let fullPrompt = speech;
  if (caller && !/\d{7,}/.test(speech)) {
    fullPrompt = `${speech} (phone ${caller.replace(/^\+/, '')})`;
  }

  const result = await handleChatMessage(env.DB, fullPrompt);

  // Clean reply text for TTS per NVIDIA voice agent guidelines (ordinal dates, clean plain text)
  let spokenReply = result.reply
    .replace(/\*\*/g, '')
    .replace(/[•#]/g, '')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (match) => formatSpokenDate(match))
    .replace(/\/receipt\.html\?id=[\w-]+/g, 'We have texted your official digital receipt link to your phone.');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">${escapeXml(spokenReply)}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna">Is there anything else I can assist you with today?</Say>
  <Gather input="speech" action="/api/calls/process" method="POST" timeout="4" language="en-US"/>
  <Say voice="Polly.Joanna">Thank you for calling Suyat Dental Clinic. Take care of your smile!</Say>
</Response>`;

  if (contentType.includes('application/json')) {
    return Response.json({
      reply: spokenReply,
      booked: result.booked,
      caller,
    });
  }

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}
