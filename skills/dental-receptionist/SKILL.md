---
name: dental-receptionist
description: 24/7 AI Receptionist skill for Suyat Dental Clinic. Use when managing patient appointments, checking open slots, booking or rescheduling visits, delivering official digital proof receipts, or generating clinic administrative reports.
metadata:
  version: 1.0.0
  publisher: GlobalPartner05
  tags:
    - healthcare
    - dental
    - reception
    - scheduling
    - dify
    - nvidia-digital-health
---

# Suyat Dental Clinic — AI Receptionist Skill

This skill allows AI agents (in Dify, Base44, or autonomous frameworks) to manage patient booking queries, deliver verified proof of appointment receipts, handle voice calls, and generate daily clinic reports.

## Clinic Branches & Hours

- **San Nicolas Branch (Pangasinan):**
  - **Days:** Monday – Tuesday
  - **Hours:** 9:00 AM – 6:00 PM
  - **Location:** Sta. Maria West, San Nicolas, Pangasinan
- **Project 6 Branch (Quezon City):**
  - **Days:** Wednesday – Saturday
  - **Hours:** 10:00 AM – 6:00 PM
  - **Location:** 111 – B2 Rd 3, Cor. Road 7, Project 6, Quezon City

## Capabilities

1. **Slot Inquiries (`checkAvailableSlots`)**:
   - Check open clinic hours for any date in `YYYY-MM-DD` format.
   - Filter by morning vs. afternoon preferences.

2. **Booking (`bookAppointment`)**:
   - Requires: `patientName`, `patientPhone`, `serviceType`, `date` (YYYY-MM-DD), `time` (HH:MM).
   - Generates official reference code (`SUYAT-XXXXXXXX`) and digital receipt URL (`/receipt.html?id=...`).

3. **Rescheduling (`rescheduleAppointment`)**:
   - Safely updates confirmed appointments while freeing old slots and checking collision.

4. **Proof of Appointment Receipts (`getAppointmentReceipt`)**:
   - Returns verified proof of appointment card including clinic address, reference code, status, and patient instructions.

5. **Inbound Voice Calls (`/api/calls/incoming`)**:
   - Telephony webhook (TwiML / JSON) that speaks natural ordinal dates (e.g. *"October 20th 2026"*) and texts digital receipt links to callers.

6. **Clinic Reports & Analytics (`generateClinicReport`)**:
   - Returns breakdown of confirmed, completed, and cancelled appointments plus service statistics.

## Integration with Dify

Import the OpenAPI specification from `public/dify-openapi.yaml` into Dify:
1. Go to **Dify Console** → **Tools** → **Custom Tool**.
2. Click **Create Custom Tool** and paste the content of `public/dify-openapi.yaml`.
3. Set Authorization to **None** for public booking or **Bearer Token** for staff admin reporting endpoints.
