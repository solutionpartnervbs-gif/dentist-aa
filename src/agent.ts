import { AIChatAgent } from '@cloudflare/ai-chat';
import { createWorkersAI } from 'workers-ai-provider';
import {
  convertToModelMessages,
  isStepCount,
  streamText,
  tool,
} from 'ai';
import { z } from 'zod';
import {
  bookAppointment,
  cancelAppointment,
  checkAvailableSlots,
  queryAppointments,
  rescheduleAppointment,
  getAppointmentReceipt,
  generateClinicReport,
} from './tools.js';
import type { Env } from './server.js';

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

const SYSTEM = `You are the 24/7 AI ambient healthcare voice and chat receptionist for Suyat Dental Clinic (timezone Asia/Manila), modeled on NVIDIA Digital Health Voice Agent standards.

Clinic Locations & Hours:
- San Nicolas, Pangasinan: Monday – Tuesday (9:00 AM – 6:00 PM)
- Project 6, Quezon City: Wednesday – Saturday (10:00 AM – 6:00 PM)

Healthcare & Conversation Guidelines:
1. CLINICAL SAFETY: You are an appointment scheduling and clinic information assistant. Do not provide medical/dental diagnosis, treatment planning, or dosage guidance. If the patient describes acute severe trauma, uncontrolled bleeding, or breathing difficulty, immediately advise them to seek emergency medical attention.
2. SPOKEN DATES & NATURAL VOICE: When speaking or writing dates for voice delivery, use natural spoken formats like "Oct 20th 2026 at 10:00 AM". Keep numeric YYYY-MM-DD for tool arguments.
3. CONVERSATION FLOW:
   - Understand the patient's needed dental care (cleaning, fillings, root canal, braces consultation, whitening, extractions, etc.).
   - Confirm preferred date range and time window (morning or afternoon).
   - Use checkAvailableSlots to offer 2-3 open slots.
   - Collect patient full name, contact phone number, and visit reason.
   - Use bookAppointment to confirm the booking, providing the official reference number (e.g. SUYAT-XXXX) and digital receipt link.
4. RESCHEDULING & PROOF OF APPOINTMENT:
   - Patients can reschedule or check appointment status by phone number anytime.
   - Provide official proof of appointment receipts via getAppointmentReceipt.
5. CONCISE & WARM: Respond in 1-2 clear, helpful sentences. Be warm and polite.`;

export class DentalAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const tools = {
      checkAvailableSlots: tool({
        description:
          'List open clinic hours (HH:MM) for a date. Returns taken-free slots.',
        inputSchema: z.object({ date: z.string() }),
        execute: async ({ date }) =>
          checkAvailableSlots(this.env.DB, date),
      }),
      bookAppointment: tool({
        description: 'Book a confirmed appointment for a patient and return receipt link.',
        inputSchema: z.object({
          patientName: z.string(),
          patientPhone: z.string(),
          patientEmail: z.string().optional(),
          serviceType: z.string(),
          date: z.string(),
          time: z.string(),
        }),
        execute: async (input) => bookAppointment(this.env.DB, input),
      }),
      rescheduleAppointment: tool({
        description: 'Reschedule an existing confirmed appointment to a new date and time.',
        inputSchema: z.object({
          patientPhone: z.string(),
          oldDate: z.string(),
          newDate: z.string(),
          newTime: z.string(),
        }),
        execute: async (input) => rescheduleAppointment(this.env.DB, input),
      }),
      cancelAppointment: tool({
        description:
          "Cancel a patient's confirmed appointment, freeing the slot.",
        inputSchema: z.object({
          patientPhone: z.string(),
          date: z.string(),
        }),
        execute: async (input) => cancelAppointment(this.env.DB, input),
      }),
      queryAppointments: tool({
        description: 'Find patient appointments by phone number.',
        inputSchema: z.object({
          patientPhone: z.string(),
          date: z.string().optional(),
        }),
        execute: async (input) => queryAppointments(this.env.DB, input),
      }),
      getAppointmentReceipt: tool({
        description: 'Get official proof of appointment / digital receipt by appointment ID.',
        inputSchema: z.object({ id: z.string() }),
        execute: async ({ id }) => getAppointmentReceipt(this.env.DB, id),
      }),
      generateClinicReport: tool({
        description: 'Generate appointment summary report and analytics for clinic staff.',
        inputSchema: z.object({ date: z.string().optional() }),
        execute: async (input) => generateClinicReport(this.env.DB, input),
      }),
    };

    const messages = await convertToModelMessages(this.messages);
    const run = (model: string) =>
      streamText({
        model: workersai(model),
        system: SYSTEM,
        messages,
        tools,
        stopWhen: isStepCount(5),
      });

    try {
      return run(PRIMARY_MODEL).toUIMessageStreamResponse();
    } catch {
      return run(FALLBACK_MODEL).toUIMessageStreamResponse();
    }
  }
}

