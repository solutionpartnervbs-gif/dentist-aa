# Head elements — suyatdental.com `/`  (paste-ready, NOT deployed)

Page evidence: `web/index.html` and the rendered landing page. Counts are character counts (display conventions, not published limits).

| Element | Current | Count | Proposed | Count | Verdict |
|---|---|---|---|---|---|
| `<title>` | Suyat Dental Clinic — Comprehensive Dental Care, Book 24/7 | 58 | **unchanged** | 58 | Meets every requirement (≈60 chars, unique, reads as a sentence). Left as is. |
| meta description | Cleaning, restorations, braces, whitening and extractions at Suyat Dental Clinic in San Nicolas, Pangasinan and Project 6, Quezon City. Book anytime with our AI receptionist. | 174 | Cleanings, fillings, braces, whitening and extractions at two branches: San Nicolas, Pangasinan and Project 6, Quezon City. Book online now. | 140 | Current is over the 160 display range and gets cut off in results. Rewritten; it ends in a specific action. |
| og:title | Suyat Dental Clinic | 19 | Suyat Dental Clinic — Comprehensive Dental Care | 47 | Adds what the clinic does for a shared link. |
| og:description | Comprehensive dental care for a healthier, brighter smile. After-hours appointments available. | 94 | Healthier, brighter smiles at San Nicolas, Pangasinan and Project 6, Quezon City. Message our AI receptionist to book. | 118 | Names both branches and the booking action. |

```html
<title>Suyat Dental Clinic — Comprehensive Dental Care, Book 24/7</title>
<meta name="description" content="Cleanings, fillings, braces, whitening and extractions at two branches: San Nicolas, Pangasinan and Project 6, Quezon City. Book online now." />
<link rel="canonical" href="https://suyatdental.com/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Suyat Dental Clinic" />
<meta property="og:url" content="https://suyatdental.com/" />
<meta property="og:title" content="Suyat Dental Clinic — Comprehensive Dental Care" />
<meta property="og:description" content="Healthier, brighter smiles at San Nicolas, Pangasinan and Project 6, Quezon City. Message our AI receptionist to book." />
<meta property="og:image" content="https://suyatdental.com/images/posters/hero.webp" />
<meta property="og:image:width" content="1280" />
<meta property="og:image:height" content="720" />
<meta property="og:image:alt" content="Suyat Dental Clinic: Comprehensive dental care for a healthier, brighter smile" />
<meta name="twitter:card" content="summary_large_image" />
```

## Open items (not filled, not invented)
- **Domain unverified:** `suyatdental.com` is only named in the voice-call script (`src/calls.ts`) and by you. I did not confirm it resolves to this Worker. Confirm before using the canonical/og:url values.
- **Share image format:** the only 1280x720 share image is a `.webp`. Several social crawlers handle webp unreliably. Safer: export a PNG or JPG of that poster and use it in `og:image` (the og:image currently in `web/index.html` points to the favicon SVG, which most platforms ignore).
- **Check after deploy:** view the page source on the live URL, then test the link in the Facebook Sharing Debugger. Only the platform can say how the preview renders.
