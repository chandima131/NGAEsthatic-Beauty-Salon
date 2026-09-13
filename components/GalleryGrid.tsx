import { galleryImages } from '../lib/gallery';

export default function GalleryGrid({ preview = false }: { preview?: boolean }) {
  return <div className="treatment-gallery-grid">
    {galleryImages.map(image => <figure className="treatment-gallery-card" key={image.src}>
      <a className="treatment-gallery-image" href={preview ? '/gallery' : image.src} target={preview ? undefined : '_blank'} rel={preview ? undefined : 'noopener noreferrer'} aria-label={preview ? `Explore ${image.title} in the gallery` : `View full-size ${image.title} image (opens in a new tab)`}>
        <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async"/>
      </a>
      <figcaption><span>{image.title}</span><a href={preview ? '/gallery' : image.src} target={preview ? undefined : '_blank'} rel={preview ? undefined : 'noopener noreferrer'} aria-label={preview ? `Explore ${image.title}` : `View full-size ${image.title} (opens in a new tab)`}>{preview ? 'Explore' : 'View full image'} <span aria-hidden="true">↗</span></a></figcaption>
    </figure>)}
  </div>;
}
