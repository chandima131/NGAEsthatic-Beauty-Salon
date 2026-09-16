import { useState } from 'react';
import { business } from '../lib/business';
import SocialLinks from './SocialLinks';

export const links = [
  ['Home', '/#home'],
  ['About', '/#about'],
  ['Services & Prices', '/#services'],
  ['Book', '/#booking'],
  ['Gallery', '/#gallery'],
  ['Reviews', '/#reviews'],
  ['Contact', '/#contact'],
];

export default function Header() {
  const [open, setOpen] = useState(false);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="topbar">
      <div className="topbar-inner">
        <span className="topbar-location">HATTERSLEY, HYDE</span>
        <span className="topbar-message">A little self-care, close to home.</span>
        <div className="topbar-actions">
          <a className="topbar-phone" href={business.telephone}>{business.phone}</a>
          <SocialLinks className="topbar-socials"/>
        </div>
      </div>
    </div>
    <header className="header">
      <a className="brand" href="/" aria-label="NG Aesthetics & Beauty Lab home">
        <img src="/images/logo.jpg" alt="NG Aesthetics & Beauty Lab logo" width="68" height="68"/>
        <span>NG Aesthetics<small>&amp; BEAUTY LAB</small></span>
      </a>
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="navigation" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
      <nav id="navigation" className={open ? 'nav open' : 'nav'} aria-label="Main navigation" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
        {links.map(([name, url]) => <a key={url} href={url} onClick={() => setOpen(false)}>{name}</a>)}
        <a className="button small" href="/#booking">Book now <span aria-hidden="true">&rarr;</span></a>
      </nav>
    </header>
  </>;
}
