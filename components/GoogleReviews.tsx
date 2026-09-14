import { useEffect, useId, useRef, useState } from 'react';
import { clientReviews, googleMapsUrl, type ClientReview } from '../lib/client-reviews';

function Stars({ rating }: { rating: number }) {
  return <span className="google-stars" role="img" aria-label={`${rating} out of 5 stars`}><span aria-hidden="true">★★★★★</span><span aria-hidden="true" style={{ width: `${rating * 20}%` }}>★★★★★</span></span>;
}

function ReviewCard({ review }: { review: ClientReview }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const textId = useId();
  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [review.text, expanded]);
  const initials = review.name.split(' ').map(part => part[0]).slice(0, 2).join('');
  return <article className="google-review-card" aria-label={`Review by ${review.name}`}>
    <div className="review-author"><span className="review-avatar avatar-placeholder" aria-hidden="true">{initials}</span><span>{review.name}</span></div>
    <Stars rating={review.rating}/>
    <div className="review-copy"><p ref={textRef} id={textId} className={expanded ? 'review-text expanded' : 'review-text'}>{review.text}</p>{(overflows || expanded) && <button className="review-more" aria-expanded={expanded} aria-controls={textId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Read less' : 'Read more'}</button>}</div>
    <div className="review-meta"><span className="review-date">At capture: {review.dateLabel}</span><span className="google-attribution" translate="no">Google Maps</span></div>
    <a className="review-source" href={googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open the salon's Google listing to read reviews`}>View on Google <span aria-hidden="true">↗</span></a>
  </article>;
}

export default function GoogleReviews() {
  const [position, setPosition] = useState({ start: true, end: false });
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setPosition({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);
  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * ((card?.offsetWidth || element.clientWidth) + gap), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <section id="reviews" className="google-reviews" aria-labelledby="google-reviews-title"><div className="section">
    <div className="google-review-heading"><p className="eyebrow">YOUR EXPERIENCE MATTERS</p><h2 id="google-reviews-title">Rated by Our Clients</h2></div>
    <div className="google-rating-summary"><img className="google-maps-logo" src="/images/google-maps-attribution.svg" alt="Google Maps" width="98" height="19"/><p>{clientReviews.length} selected Google reviews from our clients</p></div>
    <div className="review-carousel-heading"><p>A little love from our clients</p><div className="review-controls"><button aria-label="Previous review" aria-controls={trackId} disabled={position.start} onClick={() => move(-1)}>←</button><button aria-label="Next review" aria-controls={trackId} disabled={position.end} onClick={() => move(1)}>→</button></div></div>
    <div className="review-track" id={trackId} ref={track} role="region" aria-roledescription="carousel" aria-label="Client Google reviews" tabIndex={0} onKeyDown={event => { if (event.target === event.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>{clientReviews.map(review => <ReviewCard key={review.name} review={review}/>)}</div>
    <p className="review-capture-note">Selected reviews reproduced from supplied screenshots. Dates reflect when the screenshots were captured.</p>
    <div className="actions review-actions"><a className="button" href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Read All Google Reviews <span aria-hidden="true">↗</span></a><a className="button outline" href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Leave a Google Review <span aria-hidden="true">↗</span></a></div>
  </div></section>;
}
