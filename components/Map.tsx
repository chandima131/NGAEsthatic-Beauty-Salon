import { business } from '../lib/business';

export default function Map() {
  const coordinates = `${business.coordinates.latitude},${business.coordinates.longitude}`;
  return <div className="location-map">
    <iframe
      title={`Google Maps: ${business.name}, Hattersley, Hyde`}
      src={`https://maps.google.com/maps?q=${encodeURIComponent(coordinates)}&z=17&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      allowFullScreen
    />
  </div>;
}
