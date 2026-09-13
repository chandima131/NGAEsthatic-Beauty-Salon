import Map from './Map';
import { business } from '../lib/business';

export default function LocationSection() {
  return <section className="location-section" aria-labelledby="salon-location-title">
    <div className="location-layout">
      <div className="location-copy">
        <p className="eyebrow">PLAN YOUR VISIT</p>
        <h2 id="salon-location-title">Find your way<br/>to <span>NG Aesthetics.</span></h2>
        <address><strong>{business.name}</strong><br/>{business.address}</address>
        <a className="location-link" href={business.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a>
      </div>
      <Map/>
    </div>
  </section>;
}
