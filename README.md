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
- Reviews: `Testimonials` in `components/Site.tsx` remains hidden until genuine approved reviews are supplied.
- Booking enquiries: `components/ContactForm.tsx`. The validated form prepares a message; the visitor follows a link and sends it in WhatsApp. No website database, email delivery or appointment confirmation is implied.
- Domain: update `business.siteUrl` or NEXT_PUBLIC_SITE_URL before rebuilding for a custom domain. Canonicals, social metadata, sitemap and robots share this value.

## Before a public launch

Confirm owner biography/qualifications, visiting times, treatment suitability/preparation wording, client privacy information and booking/deposit/cancellation terms. These have not been invented. Policy pages explain the current website flow, with TODOs for owner-specific information.

GA4, Meta Pixel and Search Console values are reserved in business configuration. Optional tracking is deliberately inactive; add a suitable consent implementation before enabling analytics or advertising. An external booking/payment provider can be connected through `business.bookingUrl`. No payment processor is currently configured. Google Maps is loaded only after the visitor selects its button.

## Images

Built-in image generation was used for these illustrative assets:

- Hero: luxurious modern blush-and-white treatment room; female therapist preparing towels and a facial tray; soft natural lighting; realistic photography; no procedures, text or logos.
- Facial: client resting with towel headband while a professional aesthetician gently applies a cosmetic mask; neutral blush salon; realistic skin texture; no invasive procedure or text.
- Makeup: South Asian woman with elegant occasion makeup, ivory outfit and softly styled hair; makeup brush near cheek; warm natural light; no text or logos.
- `public/og.png`: branded landscape with exact title “NG Aesthetics & Beauty Lab” and subtitle “Beauty & aesthetic treatments in Hyde”.

Responsive WebP files are served locally. Cormorant Garamond and Manrope Latin WOFF2 subsets are also served locally with font-display: swap.
