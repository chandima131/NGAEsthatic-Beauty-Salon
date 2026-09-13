# NG Aesthetics & Beauty Lab

Responsive salon website built with React and Vinext, with 18 content pages, original supplied logo, generated illustrative photography, structured prices, local SEO and WhatsApp enquiry flow.

## Run

Use Node 22.13+ and npm. On Windows PowerShell use `npm.cmd` if script execution is disabled.

```sh
npm install
npm run dev
npm run lint
npx tsc --noEmit
node scripts/check-site.mjs
node scripts/check-browser.mjs
npm run build
```

The check scripts require the development server at localhost:3000. Override the HTTP checker using TEST_ORIGIN if necessary. Browser QA uses an isolated headless Chrome session, with no access to your personal browser profile. All requested widths (375, 390, 430, 768, 1024 and 1440px), mobile navigation, pricing accordions, enquiry validation and WhatsApp message preparation passed. Axe reported zero WCAG A/AA violations on five representative pages. Screenshots and the accessibility report are under `outputs/qa/`. These checks are not a claim of full WCAG certification or a published PageSpeed score.

## Content updates

- Business/contact/booking details and future integration IDs: `lib/business.ts`.
- All 38 prices and treatment text: `lib/services.ts`. Prices were checked against the supplied brief and nine service graphics.
- Original logo: `public/images/logo.jpg` (unchanged proportions).
- Hero: `public/images/hero-beauty-salon.webp` and its 640px variant. All image sources are in the workspace; no runtime dependency on generated-image directories.
- Gallery: `app/gallery/page.tsx`. Replace illustrative images with approved salon/client photographs, with consent and accurate labels. Do not represent generated images as business premises or results.
- Reviews: `components/GoogleReviews.tsx` loads `/api/google-reviews`; missing configuration or API failures show the Google Maps fallback. See setup below.
- Booking enquiries: `components/ContactForm.tsx`. The validated form prepares a message; the visitor follows a link and sends it in WhatsApp. No website database, email delivery or appointment confirmation is implied.
- Domain: update `business.siteUrl` or NEXT_PUBLIC_SITE_URL before rebuilding for a custom domain. Canonicals, social metadata, sitemap and robots share this value.

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
4. Set both `GOOGLE_MAPS_API_KEY` (secret) and `GOOGLE_PLACE_ID` in Sites runtime environment settings. The local file is ignored by Git and never packaged. Restart the local server after changing local environment values.
5. Check `/api/google-reviews` returns `available: true` and verify the live business, aggregate rating, count, authors, dates and links. No live verification is possible until credentials are configured.

Places API (New) returns up to five reviews sorted by relevance, with no latest-first option or review pagination. The carousel preserves this order and labels it. Each card shows the original review text, with four initial lines and expansion when it overflows, author name/profile/avatar where returned, rating, date, attribution and source link. A rating-only review remains text-free. No sample reviews are included.

The endpoint uses an eight-second timeout, a fixed environment Place ID, an explicit field mask and `no-store` for upstream and downstream responses. It never returns credentials or upstream errors. Review data is not persisted. The official Google Maps attribution asset is from https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip. Attribution requirements: https://developers.google.com/maps/documentation/places/web-service/policies.
