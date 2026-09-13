# NG Aesthetics & Beauty Lab

React + TypeScript frontend, Vite build tooling, and a standalone Node.js HTTP backend. The migration removes Next.js and Vinext while retaining all 18 pages, the salon design, map, review carousel, prices and WhatsApp enquiry flow.

## Run locally

Use Node.js 22.13+ and npm. In Windows PowerShell, use `npm.cmd` if script execution is disabled.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The Node server integrates Vite in development for React hot updates. Set `PORT` if port 3000 is occupied.

## Build and run in production

```sh
npm run build
npm start
```

Production listens on `HOST` (default `0.0.0.0`) and `PORT` (default `3000`). Deploy the complete `dist/` directory to any Node.js host and start `node dist/node.mjs`. The production bundle contains its React dependencies, so it does not require Vite or a development server. Supply environment variables through the host; local development also reads ignored `.env.local` and `.env` files without overriding existing process variables.

## Structure and routing

- `client/main.tsx`: hydrates the server-rendered React application.
- `app/App.tsx`: explicit route registry for static pages and treatment slugs; links use standard browser navigation and direct URLs work on refresh.
- `app/` and `components/`: ordinary React components, with no Next.js routing or runtime dependency.
- `server/node.mjs`: standalone Node HTTP server, public static-file delivery and development integration.
- `server/handler.tsx`: React server rendering, page-specific SEO metadata, sitemap, robots, 404s and API routing.
- `server/google-reviews.ts`: server-only Google Places API access.
- `server/worker.ts`: small adapter for the existing private Sites host. Sites runs this adapter on its Worker runtime; use the Node entrypoint above on a Node.js host.
- `dist/client/`: public browser assets. `dist/server/` and `dist/template.html` are private server files and must not be exposed as static roots.

All pages arrive as rendered HTML and hydrate with React. Canonicals, Open Graph/X previews, structured salon data, treatment-specific images and real 404 responses are preserved. Public `VITE_SITE_URL` is a build-time setting; server secrets must never use a `VITE_` prefix.

## Validation

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

The test command starts an isolated production Node server on an ephemeral local port. It checks all 18 pages, 38 prices, internal links, image assets, metadata, sitemap, robots, HTTP methods, restricted file paths, browser bundle secret isolation and the Google reviews backend. It does not contact Google with test credentials. `npm run test:site` checks a running development server; override `TEST_ORIGIN` if needed.

The optional `scripts/check-browser.mjs` checks browser interactions and accessibility when browser testing is requested. Reports under `outputs/qa/` predate this migration and are not evidence of a new browser test run.

## Content updates

- Business/contact/booking details and future integration IDs: `lib/business.ts`.
- All 38 prices and treatment text: `lib/services.ts`. Prices were checked against the supplied brief and nine service graphics.
- Original logo: `public/images/logo.jpg` (unchanged proportions).
- Hero: `public/images/hero-beauty-salon.webp` and its 640px variant. All image sources are in the workspace; no runtime dependency on generated-image directories.
- Gallery: `lib/gallery.ts` lists the four supplied treatment artworks in `public/images/gallery/`. `components/GalleryGrid.tsx` displays the complete images on the gallery page and homepage, with full-image links on the gallery page.
- Reviews: `components/GoogleReviews.tsx` loads `/api/google-reviews`; missing configuration or API failures show the Google Maps fallback. See setup below.
- Booking enquiries: `components/ContactForm.tsx`. The validated form prepares a message; the visitor follows a link and sends it in WhatsApp. No website database, email delivery or appointment confirmation is implied.
- Domain: update `business.siteUrl` or VITE_SITE_URL before rebuilding for a custom domain. Canonicals, social metadata, sitemap and robots share this value.

## Before a public launch

Confirm owner biography/qualifications, visiting times, treatment suitability/preparation wording, client privacy information and booking/deposit/cancellation terms. These have not been invented. Policy pages explain the current website flow, with TODOs for owner-specific information.

GA4, Meta Pixel and Search Console values are reserved in business configuration. Optional tracking is deliberately inactive; add a suitable consent implementation before enabling analytics or advertising. An external booking/payment provider can be connected through `business.bookingUrl`. No payment processor is currently configured. The homepage and contact page share a pink split-panel location section. Its Google Maps iframe loads automatically near the viewport, using the supplied coordinates; the adjacent link opens the exact business listing. Google map tiles, controls and attribution retain their original appearance.

## Images

Built-in image generation was used for these illustrative assets:

- Hero: luxurious modern blush-and-white treatment room; female therapist preparing towels and a facial tray; soft natural lighting; realistic photography; no procedures, text or logos.
- Facial: client resting with towel headband while a professional aesthetician gently applies a cosmetic mask; neutral blush salon; realistic skin texture; no invasive procedure or text.
- Makeup: South Asian woman with elegant occasion makeup, ivory outfit and softly styled hair; makeup brush near cheek; warm natural light; no text or logos.
- `public/og.png`: branded landscape with exact title “NG Aesthetics & Beauty Lab” and subtitle “Beauty & aesthetic treatments in Hyde”.

Responsive WebP files are served locally. Cormorant Garamond and Manrope Latin WOFF2 subsets are also served locally with font-display: swap.

## Google reviews setup

1. Enable Google Places API (New) and billing in your Google Cloud project. Restrict the key to Places API (New), with server IP restrictions where your hosting provides stable egress IPs.
2. Copy `.env.example` to `.env.local` and set `GOOGLE_MAPS_API_KEY`. Never use a `NEXT_PUBLIC_` or `VITE_` prefix for this secret.
3. Run `node scripts/resolve-google-place.mjs`. This uses Places API (New) Text Search with the supplied name and coordinates, and only saves `GOOGLE_PLACE_ID` on a unique exact-name match within 300 metres. Ambiguous results require manual confirmation; it never scrapes Maps HTML.
4. Set both `GOOGLE_MAPS_API_KEY` (secret) and `GOOGLE_PLACE_ID` in your Node hosting environment, or in Sites runtime environment settings for the existing private site. The local file is ignored by Git and never packaged. Restart the local server after changing local environment values.
5. Check `/api/google-reviews` returns `available: true` and verify the live business, aggregate rating, count, authors, dates and links. No live verification is possible until credentials are configured.

Places API (New) returns up to five reviews sorted by relevance, with no latest-first option or review pagination. The carousel preserves this order and labels it. Each card shows the original review text, with four initial lines and expansion when it overflows, author name/profile/avatar where returned, rating, date, attribution and source link. A rating-only review remains text-free. No sample reviews are included.

The endpoint uses an eight-second timeout, a fixed environment Place ID, an explicit field mask and `no-store` for upstream and downstream responses. It never returns credentials or upstream errors. Review data is not persisted. The official Google Maps attribution asset is from https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip. Attribution requirements: https://developers.google.com/maps/documentation/places/web-service/policies.
