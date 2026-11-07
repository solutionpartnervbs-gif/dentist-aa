# Navy Yard Dental: public-site investigation

Observed 2026-11-06. Scope: publicly accessible pages and links; no appointment, form, or patient information was submitted. This is an investigation, not a reconstruction of private source code or an integration with the practice's systems.

## Site map and observed behavior

- [Homepage](https://navyyarddental.com/): practice contact details, new-patient overview, emergency information, technology, hours, Instagram feed and appointment link.
- [Services](https://navyyarddental.com/services/): preventive, restorative, cosmetic and sedation dentistry; links to more detailed pages.
- [New patients](https://navyyarddental.com/new-patients-2/): external patient forms; states PPO dental insurance is welcomed, HMOs and Medicaid are not accepted, and identifies payment and financing options. Coverage should be verified with the practice.
- [New patient experience](https://navyyarddental.com/new-patient-experience/): describes the initial exam, x-rays, screening and cleaning.
- [VA Community Care](https://navyyarddental.com/va-community-care-network/): describes eligibility and prior VA authorization.
- [Technology](https://navyyarddental.com/latest-technology/): describes digital x-rays, nitrous oxide, in-office 3D printing and milling.
- [Dr. Chad Jones](https://navyyarddental.com/doctor-chad-jones/) and [Dr. Bethlehem Yehudah](https://navyyarddental.com/dr-bethlehem-yehudah/): provider biographies.
- [Directions](https://navyyarddental.com/contact/): location, Metro directions, parking and an embedded Google map.
- The Schedule Appointment link takes visitors to a third-party [PatientViewer scheduler](https://www.patientviewer.com/?C=1341&CID=30&RSID=3131323333). Its web page requires JavaScript. The new-patient page also links to external PatientViewer forms. No scheduler availability, booking API, authentication, or successful booking was established.

## Contact and conflicting information

The site lists 55 M St SE, Suite 103, Washington, DC 20003; phone 202-670-4882; email info@NavyYardDental.com; and fax 202-600-2837.

The homepage body lists Monday, Tuesday, Wednesday and Friday 9 AM–6 PM, while the footer says Tuesday is closed and lists Monday, Wednesday and Friday 9 AM–6 PM. The homepage also mentions Saturday emergencies by appointment, while its hours say weekends are closed. Ask the practice to verify the schedule and emergency availability before using either as booking rules. Washington, DC uses `America/New_York`, including daylight saving time; confirm the intended operating timezone with the practice.

## Relationship to this repository

The existing application is a Cloudflare Worker with a static chat page, a Durable Object agent, D1 appointment data, admin routes, and Telegram/email-related code. `public/index.html` advertises 09:00–17:00 Manila hours and calls `/api/chat`. Its appointments are stored locally in its configured D1 database; this investigation found no evidence that those appointments synchronize with PatientViewer or the actual practice schedule.

Before using the assistant for this practice:

1. Obtain verified hours, services, scheduling policy and practice authorization; correct timezone handling throughout booking and reminders.
2. Decide whether the assistant should link to the existing PatientViewer flow or use an authorized integration. A local D1 booking must not be represented as a confirmed practice appointment without synchronization and confirmation.
3. Review privacy, security, retention and vendor agreements before collecting real patient or health information. Verify insurance and emergency guidance with the office.
4. Review the existing implementation and perform end-to-end tests with a permitted test environment before deployment.

## Evidence and limits

REA `capture_browser_scenario` launched Chromium and observed navigation to the homepage, but timed out during cleanup (`cleanup_incomplete`, browser transport and temporary profile). Its partial observation recorded the final URL, not DOM, visual, interaction or network evidence; cleanup was not confirmed. No claim of a completed REA trace is made. The page and link observations above come from separately retrieved public pages. Server-side source, databases, private APIs, scheduling logic, responsive design, interactive behavior and integrations remain unverified. Page content can change and some retrieved pages may have been cached.

## Follow-up: delivered homepage code

The homepage HTML was fetched directly and saved as `navy-yard-homepage-capture.html`; inline JavaScript was extracted to `navy-yard-public-scripts/`. The delivered HTML identifies WordPress and the Medical Circle Pro theme, and references Gutentor, Instagram Feed, SiteOrigin widgets, Call Now Button, Bootstrap, jQuery and Google Fonts. These are observations about delivered asset references, not proof of the current server configuration or every plugin in use. External JavaScript and stylesheets were not included in the static REA analysis.

REA `analyze_javascript_application` inspected the ten extracted inline scripts without executing them. Its summary reported nine fully parsed sources, one parse failure, and partial application and semantic coverage. Parent evidence ID: `ev_5bf0b5c3876728dfbdbf56c1b75e73824cc0c2578800068bf4520f998c5e9dd6`; artifact SHA-256: `8c2a85fe7f246db8f069e13f848cbe530379c83347b2f6e5c0afae3da4a72966`. Static analysis of these inline snippets cannot establish interactive behavior, backend routes, or PatientViewer's booking implementation.

Further service pages identify cleanings and sealants, fillings, crowns, root canals, dentures, extractions and implants, clear aligners, veneers, whitening, and sedation. See [preventive](https://navyyarddental.com/preventative-dentistry/), [restorative](https://navyyarddental.com/restorative-dentistry/), [cosmetic](https://navyyarddental.com/cosmetic-dentistry/), and [sedation](https://navyyarddental.com/sedation-dentistry/). These descriptions are public-site content and should be verified before a clinical assistant relies on them.
