import Map from './Map';
import { business } from '../lib/business';

export default function LocationSection() {
  return <section className="map-section" aria-labelledby="salon-location-title">
    <div>
      <p className="eyebrow">FIND YOUR WAY TO US</p>
      <h2 id="salon-location-title">Your beauty destination<br/>in <em>Hattersley, Hyde.</em></h2>
      <p>{business.name}<br/>{business.address}</p>
      <a className="button outline" href={business.mapsUrl} target="_blank" rel="noopener noreferrer">Open Google Maps <span aria-hidden="true">↗</span></a>
      <p className="fineprint">View our Google listing and get directions for your visit.</p>
    </div>
    <Map/>
  </section>;
}
