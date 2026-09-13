'use client';

import { useState } from 'react';
import { business } from '../lib/business';

export default function Map() {
  const [loaded, setLoaded] = useState(false);
  const coordinates = `${business.coordinates.latitude},${business.coordinates.longitude}`;
  return <div className="map-card">
    {loaded ? <iframe
      title={`Google Maps: ${business.name}, Hattersley, Hyde`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(coordinates)}&z=17&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    /> : <>
      <div className="map-street street-one" aria-hidden="true"/>
      <div className="map-street street-two" aria-hidden="true"/>
      <div className="map-street street-three" aria-hidden="true"/>
      <div className="map-pin">
        <strong>{business.name}</strong>
        <p>Find us in Hattersley, Hyde.</p>
        <button type="button" className="button" onClick={() => setLoaded(true)}>Load Google Map <span aria-hidden="true">↗</span></button>
        <small>Loads content from Google Maps.</small>
      </div>
      <span className="map-label">Location illustration · not to scale</span>
    </>}
  </div>;
}
