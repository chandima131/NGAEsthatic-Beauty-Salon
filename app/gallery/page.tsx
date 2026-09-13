import { PageHero, CTASection } from '../../components/Site';
import GalleryGrid from '../../components/GalleryGrid';
import { business } from '../../lib/business';
import { seo } from '../../lib/seo';

export const metadata = seo('Beauty Gallery | NG Aesthetics & Beauty Lab Hyde', 'Explore the NG Aesthetics & Beauty Lab treatment gallery, featuring eyebrow tinting and waxing, brow styling, dermaplaning and facial treatments.', '/gallery');
export default function Gallery() {
  return <main id="main">
    <PageHero label="THE BEAUTY EDIT" title="Our treatment gallery." copy="A closer look at brows, beauty and skin care at NG Aesthetics & Beauty Lab."/>
    <section className="section gallery-section" aria-label="Treatment images">
      <GalleryGrid/>
      <p className="gallery-follow">Discover more from the salon on <a href={business.instagram}>Instagram {business.instagramHandle} ↗</a>.</p>
    </section>
    <CTASection/>
  </main>;
}
