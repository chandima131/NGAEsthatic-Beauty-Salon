# NG Aesthetics & Beauty Lab

A responsive salon website for NG Aesthetics & Beauty Lab in Hattersley, Hyde, with a customer booking calendar and protected salon admin dashboard.

The public homepage order is: hero, about, services and full price list, online booking, gallery, Google Map, genuine supplied reviews, contact form and footer. All 38 supplied prices are stored in lib/services.ts.

## Run

Use Node 22.13+ and npm.

~~~sh
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
~~~

Generate a migration after changing db/schema.ts:

~~~sh
npm run db:generate
~~~

## Booking system

- D1 stores appointment slots, unavailable periods, holidays and customer bookings.
- Customers can view live monthly availability and submit a pending appointment request.
- /admin uses a password form and a signed, HTTP-only 12-hour session cookie. No email is required.
- Admins can add day schedules, remove slots, block hours or dates, add holidays, confirm, complete, cancel, reschedule or delete bookings, and keep private notes.
- Store ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET only in server runtime settings. Neither value is exposed to browser code.
- Customer details remain in protected admin responses and are never returned by the public availability API.

Create a new password hash and session secret in PowerShell:

~~~powershell
$env:NEW_ADMIN_PASSWORD='choose-a-private-password'
npm run admin:hash
npm run admin:secret
~~~

Copy the two command outputs into ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET. Changing the password hash immediately invalidates the old password; rotating the session secret also signs out existing admin sessions.

The old public page URLs permanently redirect to the matching homepage section. The admin route is excluded from search indexing and the sitemap.

## Content notes

- The original supplied logo is public/images/logo.jpg.
- The hero and supporting salon photographs are illustrative and labelled on the page.
- Gallery artwork and six review transcriptions were supplied by the business and are kept in lib/gallery.ts and lib/client-reviews.ts.
- The contact form prepares a WhatsApp message for the visitor to review and send.
- Privacy, cookie and website terms summaries are built into the footer.
- No opening hours, qualifications, clinical claims or treatment guarantees have been invented.