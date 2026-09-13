import { type GoogleReview, type GoogleReviewsData, safeGoogleUrl } from '../lib/google-reviews';

// This route is the only application code that reads the secret. Never cache
// Google review content in the browser, CDN, framework cache, or database.
export type ReviewEnvironment = { GOOGLE_MAPS_API_KEY?: string; GOOGLE_PLACE_ID?: string };
const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
export async function getGoogleReviews(env: ReviewEnvironment) {
  const key = env.GOOGLE_MAPS_API_KEY;
  const placeId = env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return Response.json({ available: false }, { headers });
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,rating,userRatingCount,reviews,attributions,googleMapsLinks',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Places unavailable');
    const place = await response.json() as Partial<GoogleReviewsData> & { id?: string; googleMapsLinks?: { writeAReviewUri?: string } };
    if (place.id !== placeId || typeof place.rating !== 'number' || place.rating < 0 || place.rating > 5 || typeof place.userRatingCount !== 'number' || !Number.isInteger(place.userRatingCount) || place.userRatingCount < 0 || !Array.isArray(place.reviews) || !place.reviews.length) throw new Error('Reviews unavailable');
    const data: GoogleReviewsData = {
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      // Preserve Google's most-relevant order and all returned author fields.
      reviews: place.reviews.slice(0, 5).map((review: GoogleReview) => ({
        name: review.name,
        authorAttribution: review.authorAttribution,
        rating: review.rating,
        text: review.originalText || review.text,
        publishTime: review.publishTime,
        relativePublishTimeDescription: review.relativePublishTimeDescription,
        googleMapsUri: review.googleMapsUri,
      })),
      writeReviewUrl: safeGoogleUrl(place.googleMapsLinks?.writeAReviewUri) || `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
      attributions: Array.isArray(place.attributions) ? place.attributions : [],
    };
    return Response.json({ available: true, data }, { headers });
  } catch {
    // Never forward upstream errors: they can contain request details.
    return Response.json({ available: false }, { headers });
  }
}
