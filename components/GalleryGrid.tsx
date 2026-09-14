import { galleryImages } from '../lib/gallery';

export default function GalleryGrid() {
  return <div className="treatment-gallery-grid">
    {galleryImages.map(image => <figure className="treatment-gallery-card" key={image.src}>
      <a className="treatment-gallery-image" href={image.src} target="_blank" rel="noopener noreferrer" aria-label={`View full-size ${image.title} image in a new tab`}>
        <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async"/>
      </a>
      <figcaption><span>{image.title}</span><a href={image.src} target="_blank" rel="noopener noreferrer">View full image <span aria-hidden="true">↗</span></a></figcaption>
    </figure>)}
  </div>;
}