# NG Aesthetics & Beauty Lab

A responsive single-page salon website for NG Aesthetics & Beauty Lab in Hattersley, Hyde.

The page order is: hero, about, services and full price list, gallery, Google Map, genuine supplied reviews, contact form and footer. All 38 supplied prices are stored in `lib/services.ts`. Business details and future booking or analytics settings live in `lib/business.ts`.

## Run

Use Node 22.13+ and npm.

```sh
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

The old page URLs permanently redirect to the matching section on the homepage, preserving useful links while keeping the public experience to one page.

## Content notes

- The original supplied logo is `public/images/logo.jpg`.
- The hero and supporting salon photographs are illustrative and labelled on the page.
- Gallery artwork and six review transcriptions were supplied by the business and are kept in `lib/gallery.ts` and `lib/client-reviews.ts`.
- The enquiry form prepares a WhatsApp message for the visitor to review and send; it does not store submissions.
- Privacy, cookie and website terms summaries are built into the footer.
- No opening hours, qualifications, clinical claims or treatment guarantees have been invented.
- Optional analytics remain disabled. Update consent controls and the footer information before enabling them.