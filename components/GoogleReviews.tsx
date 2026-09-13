

import { useEffect, useId, useRef, useState } from 'react';
import { googleMapsUrl, safeGoogleUrl, type GoogleReview, type GoogleReviewsData } from '../lib/google-reviews';

function Stars({ rating }: { rating: number }) {
  return <span className="google-stars" role="img" aria-label={`${rating} out of 5 stars`}><span aria-hidden="true">★★★★★</span><span aria-hidden="true" style={{ width: `${Math.max(0, Math.min(5, rating)) * 20}%` }}>★★★★★</span></span>;
}

function ReviewCard({ review }: { review: GoogleReview }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const textId = useId();
  const name = review.authorAttribution?.displayName;
  const avatar = safeGoogleUrl(review.authorAttribution?.photoUri);
  const profile = safeGoogleUrl(review.authorAttribution?.uri);
  const reviewUrl = safeGoogleUrl(review.googleMapsUri) || googleMapsUrl;
  const text = review.text?.text;
  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  const date = review.publishTime ? new Date(review.publishTime) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const author = <>{avatar && !imageFailed ? <img className="review-avatar" src={avatar} alt="" width="44" height="44" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/> : <span className="review-avatar avatar-placeholder" aria-hidden="true">{name?.trim().charAt(0) || '•'}</span>}<span>{name || 'Google reviewer'}</span></>;
  return <article className="google-review-card" aria-label={name ? `Review by ${name}` : 'Google review'}>
    {profile ? <a className="review-author" href={profile} target="_blank" rel="noopener noreferrer">{author}</a> : <div className="review-author">{author}</div>}
    {typeof review.rating === 'number' && <Stars rating={review.rating}/>}
    {text && <div className="review-copy"><p ref={textRef} id={textId} className={expanded ? 'review-text expanded' : 'review-text'}>{text}</p>{(overflows || expanded) && <button className="review-more" aria-expanded={expanded} aria-controls={textId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Read less' : 'Read more'}</button>}</div>}
    <div className="review-meta">{validDate && <time dateTime={date.toISOString()} title={review.relativePublishTimeDescription}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>}<span className="google-attribution" translate="no">Google Maps</span></div>
    <a className="review-source" href={reviewUrl} target="_blank" rel="noopener noreferrer">View on Google <span aria-hidden="true">↗</span></a>
  </article>;
}

export default function GoogleReviews() {
  const [data, setData] = useState<GoogleReviewsData | null>(null);
  const [position, setPosition] = useState({ start: true, end: false });
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/google-reviews', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ available: boolean; data?: GoogleReviewsData }> : null)
      .then(result => { if (result?.available && result.data?.reviews?.length) setData(result.data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setPosition({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); };
  }, [data]);
  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * ((card?.offsetWidth || element.clientWidth) + gap), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <section className="google-reviews" aria-labelledby="google-reviews-title"><div className="section">
    <div className="google-review-heading"><p className="eyebrow">YOUR EXPERIENCE MATTERS</p><h2 id="google-reviews-title">Rated by Our Clients</h2></div>
    {!data ? <div className="google-review-fallback"><p>See what our clients say on Google</p><a className="button" href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Read All Google Reviews <span aria-hidden="true">↗</span></a></div> : <>
      <div className="google-rating-summary"><img className="google-maps-logo" src="/images/google-maps-attribution.svg" alt="Google Maps"/><div className="google-rating-line"><Stars rating={data.rating}/><strong>{data.rating.toFixed(1)}</strong><span>Google rating</span></div><p>Based on {data.userRatingCount.toLocaleString('en-GB')} Google reviews</p></div>
      <div className="review-carousel-heading"><p>Most relevant reviews, selected by Google</p><div className="review-controls"><button aria-label="Previous review" aria-controls={trackId} disabled={position.start} onClick={() => move(-1)}>←</button><button aria-label="Next review" aria-controls={trackId} disabled={position.end} onClick={() => move(1)}>→</button></div></div>
      <div className="review-track" id={trackId} ref={track} role="region" aria-roledescription="carousel" aria-label="Client Google reviews" tabIndex={0} onKeyDown={event => { if (event.target === event.currentTarget && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>{data.reviews.map((review, index) => <ReviewCard key={review.name || index} review={review}/>)}</div>
      {data.attributions.map((attribution, index) => <p className="review-provider" key={index}>{attribution.providerUri?.startsWith('https://') ? <a href={attribution.providerUri} target="_blank" rel="noopener noreferrer">{attribution.provider}</a> : attribution.provider}</p>)}
      <div className="actions review-actions"><a className="button" href={googleMapsUrl} target="_blank" rel="noopener noreferrer">Read All Google Reviews <span aria-hidden="true">↗</span></a><a className="button outline" href={data.writeReviewUrl} target="_blank" rel="noopener noreferrer">Leave a Google Review <span aria-hidden="true">↗</span></a></div>
    </>}
  </div></section>;
}
