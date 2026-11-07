# Structured data — suyatdental.com `/`

One block (`structured-data.jsonld`), one type: the page is a dental clinic with two branches, and the branch cards on the page show name, address, days and hours. Every value above comes from `web/src/config/clinic.ts` and the rendered page.

Deliberately **left out** (the page does not show them, so adding them would be markup for hidden/absent content):
- `telephone`, `email`, `sameAs` social links, `geo`, `priceRange`: no phone, email, social link or map coordinates appear anywhere on the site. Supply them (and show them on the page) before adding them.
- `aggregateRating` / `review`: no visible reviews.
- `FAQPage`, `Service` offers: no FAQ or priced services on the page.
- Postal code for either branch: not on the page.

**Conflict to resolve before deploying:** the hours above match what the page displays (San Nicolas Mon–Tue 9–6, Project 6 Wed–Sat 10–6). The booking backend (`src/db.ts`) allows Mon–Fri 9–17 and Sat 9–13. If the backend is the true schedule, change the page and this block together.

Deploy: place inside `<script type="application/ld+json">…</script>` in the page head. Then run it through Google's Rich Results Test and Schema Markup Validator; eligibility for any rich result is that platform's answer, not this file's.
