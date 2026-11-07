# llms.txt and crawler directives — suyatdental.com  (NOT deployed)

- `llms.txt` lists only the one canonical indexable page. `/admin` (staff login), `/receipt/<id>` (a patient's private proof of appointment) and `/api/*` are not listed and are blocked in `robots.txt`.
- Section anchors (`/#services`, `/#branches`) are not separate pages, so they are not listed.
- Serve `llms.txt` and `robots.txt` at the domain root. In this repo that means `web/public/` (they would then be built into `web/dist`); the Worker serves static files before running code, so no route change is needed. I did not write them there because you asked for paste-ready files.
- Owner decision needed: allow or block each AI crawler. Not defaulted.
- Verify after deploy: fetch `https://suyatdental.com/llms.txt` and `/robots.txt` and compare to these files. Note robots.txt `Disallow` stops compliant crawlers fetching a path but does not remove an already-indexed URL.
- Caution: `Disallow: /receipt/` also hides pages from crawlers that would otherwise index private receipt links; receipt URLs contain a random id but are unauthenticated, so also add `<meta name="robots" content="noindex">` on that route in the app if desired (code change, outside this skill).
