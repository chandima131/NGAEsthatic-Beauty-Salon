import type { ReactNode } from 'react';
import { business, bookingUrl } from '../lib/business';
import { categories, priceDisclaimer, type Category } from '../lib/services';
import SocialLinks from './SocialLinks';

export function Photo({ name, alt, priority = false }: { name: string; alt: string; priority?: boolean }) {
  return <picture>
    <source srcSet={'/images/' + name + '-640.webp 640w, /images/' + name + '.webp 1280w'} sizes="(max-width: 700px) 92vw, 50vw" type="image/webp"/>
    <img src={'/images/' + name + '.webp'} alt={alt} width={name === 'hero-beauty-salon' ? 1280 : 1024} height={name === 'hero-beauty-salon' ? 853 : 1536} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding={priority ? 'sync' : 'async'}/>
  </picture>;
}

export function SectionHeading({ eyebrow, title, copy, light = false }: { eyebrow: string; title: ReactNode; copy?: string; light?: boolean }) {
  return <div className={'section-heading' + (light ? ' light' : '')}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p>{copy}</p>}</div>;
}

function bookingLink(treatment: string) {
  return '/?service=' + encodeURIComponent(treatment) + '#booking';
}

function CategoryPrices({ category, index }: { category: Category; index: number }) {
  return <details className="price-category" open={index < 2} id={'prices-' + category.slug}>
    <summary><span><small>{String(index + 1).padStart(2, '0')}</small>{category.name}</span><span className="summary-mark" aria-hidden="true">+</span></summary>
    <div className="category-content">
      <p className="category-intro">{category.description}</p>
      <div className="compact-price-list">
        {category.treatments.map(treatment => <div className="compact-price" key={treatment.name}>
          <span>{treatment.name}</span><i aria-hidden="true"/><strong>£{treatment.price}</strong>
          <a href={bookingLink(treatment.name)} aria-label={'Book ' + treatment.name + ', £' + treatment.price}>Book</a>
        </div>)}
      </div>
      {category.note && <p className="category-note">{category.note}</p>}
    </div>
  </details>;
}

export function PriceDirectory() {
  return <>
    <div className="service-links" aria-label="Jump to a treatment category">
      {categories.map(category => <a key={category.slug} href={'#prices-' + category.slug}>{category.name}</a>)}
    </div>
    <div className="price-directory">{categories.map((category, index) => <CategoryPrices key={category.slug} category={category} index={index}/>)}</div>
    <p className="price-disclaimer">{priceDisclaimer}</p>
  </>;
}

export function Footer() {
  const footerLinks = [['Home','/#home'],['About','/#about'],['Services & Prices','/#services'],['Book online','/#booking'],['Gallery','/#gallery'],['Reviews','/#reviews'],['Contact','/#contact']];
  return <><footer className="footer">
    <div className="footer-lead">
      <div><p className="footer-kicker">YOUR TIME. YOUR BEAUTY.</p><h2>Ready for your<br/><em>next appointment?</em></h2></div>
      <div className="footer-lead-action"><p>Appointments are available every day from 10am to 10pm.</p><a className="button button-pale" href="/#booking">Book your appointment <span aria-hidden="true">&rarr;</span></a></div>
    </div>
    <div className="footer-grid">
      <div className="footer-brand"><a href="/" className="brand"><img src="/images/logo.jpg" width="68" height="68" alt="NG Aesthetics & Beauty Lab logo"/><span>NG Aesthetics<small>&amp; BEAUTY LAB</small></span></a><p>Professional beauty, skin and aesthetic treatments in Hattersley, Hyde.</p></div>
      <div><h3>Explore</h3><nav className="footer-links" aria-label="Footer navigation">{footerLinks.map(([name,url]) => <a href={url} key={url}>{name}</a>)}</nav></div>
      <div><h3>Visit &amp; opening hours</h3><address>Sgt Mark Stansfield Way<br/>Hattersley, Hyde<br/>SK14 3FX, United Kingdom</address><p className="footer-hours"><span>OPEN DAILY</span><strong>10:00&ndash;22:00</strong></p><a href={business.mapsUrl} target="_blank" rel="noopener noreferrer">Open Google Maps &rarr;</a></div>
      <div><h3>Contact &amp; social</h3><a className="footer-phone" href={business.telephone}>{business.phone}</a><a href={bookingUrl()}>Message on WhatsApp &rarr;</a><SocialLinks labelled className="footer-socials"/><a className="admin-link" href="/admin">Salon admin</a></div>
    </div>
    <div className="footer-info" id="privacy">
      <details><summary>Privacy</summary><p>Booking details and contact information are stored securely so the salon can manage your appointment. The salon uses them only to arrange and administer your booking, including transactional SMS updates. Please do not include medical or sensitive information. WhatsApp, Instagram and Google Maps follow their own privacy policies.</p></details>
      <details><summary>Cookies</summary><p>No optional analytics or advertising tools are enabled. Google Maps is embedded in the location section and may set its own cookies. Secure sign-in and essential hosting features may use technical cookies.</p></details>
      <details><summary>Website terms</summary><p>An online appointment is confirmed when the booking confirmation and reference appear on screen. Treatment availability and prices may change; website descriptions do not promise treatment outcomes.</p></details>
    </div>
    <div className="footer-bottom"><p>&copy; {new Date().getFullYear()} {business.name}. All rights reserved.</p><p>Made with care for beauty lovers in Hyde.</p></div>
    <div className="shade-strip" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>
  </footer>
  <a className="whatsapp-float" href={bookingUrl()} aria-label="Enquire on WhatsApp"><img src="/images/whatsapp.svg" alt="" width="22" height="22"/><span>WhatsApp</span></a></>;
}
