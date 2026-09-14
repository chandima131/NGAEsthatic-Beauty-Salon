import { useState } from 'react';
import { bookingUrl } from '../lib/business';

export const links = [
  ['Home', '#home'],
  ['About', '#about'],
  ['Services & Prices', '#services'],
  ['Gallery', '#gallery'],
  ['Reviews', '#reviews'],
  ['Contact', '#contact'],
];

export default function Header() {
  const [open, setOpen] = useState(false);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="topbar"><span>HATTERSLEY, HYDE</span><span>A little self-care, close to home.</span><a href="tel:+447801247820">+44 7801 247820</a></div>
    <header className="header">
      <a className="brand" href="#home" aria-label="NG Aesthetics & Beauty Lab home">
        <img src="/images/logo.jpg" alt="NG Aesthetics & Beauty Lab logo" width="68" height="68"/>
        <span>NG Aesthetics<small>& BEAUTY LAB</small></span>
      </a>
      <button className="menu-toggle" type="button" aria-expanded={open} aria-controls="navigation" onClick={() => setOpen(!open)}>{open ? 'Close ×' : 'Menu ☰'}</button>
      <nav id="navigation" className={open ? 'nav open' : 'nav'} aria-label="Main navigation" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
        {links.map(([name, url]) => <a key={url} href={url} onClick={() => setOpen(false)}>{name}</a>)}
        <a className="button small" href={bookingUrl()}>Book now <span aria-hidden="true">↗</span></a>
      </nav>
    </header>
  </>;
}