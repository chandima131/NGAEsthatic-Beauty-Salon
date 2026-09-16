import GalleryGrid from '../components/GalleryGrid';
import GoogleReviews from '../components/GoogleReviews';
import LocationSection from '../components/LocationSection';
import BookingCalendar from '../components/BookingCalendar';
import FloralDecor from '../components/FloralDecor';
import { bookingUrl, business } from '../lib/business';
import { Photo, PriceDirectory, SectionHeading } from '../components/Site';

export default function Home() {
  return <main id="main">
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">WELCOME TO NG AESTHETICS & BEAUTY LAB</p>
        <h1 id="hero-title">Beauty & Aesthetic<br/>Treatments in <em>Hyde.</em></h1>
        <p className="lead">A little time for you.<br/>A beautiful feeling that stays.</p>
        <p>Professional beauty and aesthetic treatments, personalised to you in our welcoming space in Hattersley, Hyde.</p>
        <div className="actions"><a className="button" href="/#booking">Book your appointment <span aria-hidden="true">↗</span></a><a className="button outline" href="#services">View services & prices</a></div>
        <div className="hero-trust"><span>Facials</span><i>•</i><span>Skin</span><i>•</i><span>Beauty</span><i>•</i><span>Makeup</span></div>
      </div>
      <div className="hero-photo">
        <Photo name="hero-beauty-salon" alt="Illustrative blush and white salon with a therapist preparing a treatment room" priority/>
        <div className="photo-caption"><span>YOUR MOMENT OF CALM</span><p>Care, confidence <em>& a little luxury.</em></p></div>
        <span className="image-note">Illustrative salon imagery</span>
      </div>
    </section>

    <section className="about-section section" id="about" aria-labelledby="about-title">
      <div className="about-photo"><Photo name="facial" alt="Illustrative relaxing facial treatment"/><div className="about-badge"><strong>NG</strong><span>A moment made for you</span></div><span className="image-note">Illustrative treatment imagery</span></div>
      <div className="about-copy">
        <p className="eyebrow">ABOUT US · HATTERSLEY, HYDE</p>
        <h2 id="about-title">Feel confident.<br/><em>Look beautiful.</em></h2>
        <p>At NG Aesthetics & Beauty Lab, we offer a range of beauty, skin and aesthetic treatments in Hattersley, Hyde. From rejuvenating facials and skin boosters to makeup, threading, waxing and beauty treatments, our aim is to provide a welcoming and professional experience tailored to you.</p>
        <p>Whether you know exactly what you want or would like to talk through the options, your visit starts with a friendly conversation.</p>
        <div className="about-values"><div><span>01</span><strong>Personalised care</strong></div><div><span>02</span><strong>Professional service</strong></div><div><span>03</span><strong>Friendly environment</strong></div></div>
        <a className="text-link" href="#contact">Plan your visit <span aria-hidden="true">↗</span></a>
      </div>
    </section>

    <section className="services-section" id="services" aria-labelledby="services-title">
      <FloralDecor/>
      <div className="section">
        <div className="services-heading">
          <SectionHeading eyebrow="SERVICES & PRICE LIST" title={<>Everything you need to<br/><em>feel beautifully you.</em></>} copy="Explore every treatment and confirmed price in one place. Open a category to see its full menu, then book straight through WhatsApp."/>
          <div className="service-collage" aria-label="Illustrative salon and treatment imagery">
            <div><Photo name="facial" alt="Illustrative facial treatment"/></div><div><Photo name="makeup" alt="Illustrative occasion makeup"/></div><div><Photo name="hero-beauty-salon" alt="Illustrative beauty treatment room"/></div>
          </div>
        </div>
        <PriceDirectory/>
      </div>
    </section>

    <BookingCalendar/>

    <section className="gallery-section section" id="gallery" aria-labelledby="gallery-title">
      <div className="split-heading"><SectionHeading eyebrow="OUR WORK" title={<>Real treatments.<br/><em>Beautiful details.</em></>} copy="A closer look at brows, beauty and skin treatments at NG Aesthetics & Beauty Lab."/><a className="text-link" href={business.instagram} target="_blank" rel="noopener noreferrer">Follow on Instagram <span aria-hidden="true">↗</span></a></div>
      <GalleryGrid/>
      <p className="gallery-note">Treatment images supplied by the business. Before-and-after photographs show individual experiences and do not guarantee the same result for everyone.</p>
    </section>

    <LocationSection/>
    <GoogleReviews/>

    <section className="contact-section" id="contact" aria-labelledby="contact-title">
      <div className="section contact-layout">
        <div className="contact-copy">
          <p className="eyebrow">CONTACT US</p>
          <h2 id="contact-title">Your next beauty moment<br/><em>starts here.</em></h2>
          <p>Ask about a treatment, tell us your preferred date, or call for a friendly conversation before you book.</p>
          <div className="contact-cards">
            <a href={business.telephone}><small>CALL US</small><strong>{business.phone}</strong><span aria-hidden="true">↗</span></a>
            <a href={bookingUrl()}><small>MESSAGE US</small><strong>Chat on WhatsApp</strong><span aria-hidden="true">↗</span></a>
            <a href={business.instagram} target="_blank" rel="noopener noreferrer"><small>FOLLOW US</small><strong>{business.instagramHandle}</strong><span aria-hidden="true">↗</span></a>
          </div>
          <address><strong>Visit NG Aesthetics & Beauty Lab</strong><br/>Sgt Mark Stansfield Way<br/>Hattersley, Hyde · SK14 3FX<br/>United Kingdom</address>
          <p className="contact-fineprint">Please contact us to confirm treatment suitability, availability and visiting times.</p>
        </div>
      </div>
    </section>
  </main>;
}
