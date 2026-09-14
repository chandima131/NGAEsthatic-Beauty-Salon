import { useState } from 'react';
import { business } from '../lib/business';
import { categories } from '../lib/services';

export default function ContactForm() {
  const [ready, setReady] = useState('');
  return <form className="contact-form" onChange={() => setReady('')} onSubmit={event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const message = `Hi NG Aesthetics & Beauty Lab, I'd like to enquire about booking.
Name: ${data.get('name')}
Phone: ${data.get('phone')}
Email: ${data.get('email') || 'Not provided'}
Treatment: ${data.get('treatment')}
Preferred date: ${data.get('date') || 'Flexible'}
Message: ${data.get('message') || ''}`;
    setReady(`${business.whatsapp}?text=${encodeURIComponent(message)}`);
  }}>
    <p className="form-kicker">SEND AN ENQUIRY</p>
    <h3>Let’s plan your visit.</h3>
    <p>Complete your details to prepare a WhatsApp message. You’ll review it before sending.</p>
    <div className="form-grid">
      <label>Name <span>*</span><input name="name" required autoComplete="name" maxLength={100}/></label>
      <label>Phone <span>*</span><input name="phone" type="tel" required autoComplete="tel" minLength={7} maxLength={25} pattern="[+0-9 ()-]{7,25}" title="Enter a phone number using digits, spaces, +, brackets or hyphens"/></label>
      <label>Email <small>(optional)</small><input name="email" type="email" autoComplete="email" maxLength={150}/></label>
      <label>Treatment <span>*</span><select name="treatment" required defaultValue=""><option value="" disabled>Select a treatment</option>{categories.map(category => <option key={category.slug}>{category.name}</option>)}</select></label>
      <label>Preferred date <small>(optional)</small><input name="date" type="date" min={new Date().toLocaleDateString('en-CA')}/></label>
      <label className="full">Message <small>(optional)</small><textarea name="message" rows={4} maxLength={1500} placeholder="Tell us what you’re interested in. Please don’t include medical or sensitive information."/></label>
    </div>
    <p className="form-note">Your enquiry is not stored by this website. Read the <a href="#privacy">privacy information</a>. Sending an enquiry does not confirm an appointment.</p>
    <button className="button form-submit" type="submit">Prepare WhatsApp enquiry <span aria-hidden="true">↗</span></button>
    <div aria-live="polite">{ready && <div className="form-ready"><p>Your message is ready. Continue to WhatsApp to review it and press Send.</p><a className="button" href={ready} target="_blank" rel="noopener noreferrer">Continue to WhatsApp <span aria-hidden="true">↗</span></a></div>}</div>
  </form>;
}