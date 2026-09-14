import Map from './Map';
import { business } from '../lib/business';

export default function LocationSection() {
  return <section className="location-section" id="location" aria-labelledby="salon-location-title">
    <div className="location-layout">
      <div className="location-copy">
        <p className="eyebrow">FIND US IN HATTERSLEY</p>
        <h2 id="salon-location-title">Beauty, just around<br/><em>the corner.</em></h2>
        <p>Visit NG Aesthetics & Beauty Lab on Sgt Mark Stansfield Way in Hattersley, Hyde.</p>
        <address><strong>{business.name}</strong><br/>Sgt Mark Stansfield Way<br/>Hattersley, Hyde · SK14 3FX<br/>United Kingdom</address>
        <a className="location-link" href={business.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>
      </div>
      <Map/>
    </div>
  </section>;
}