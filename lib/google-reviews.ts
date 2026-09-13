export const googleMapsUrl = 'https://maps.app.goo.gl/GYVoCTUVpVWDdpUJ9';

export type GoogleReview = {
  name?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
};
export type GoogleReviewsData = {
  rating: number;
  userRatingCount: number;
  reviews: GoogleReview[];
  writeReviewUrl: string;
  attributions: { provider?: string; providerUri?: string }[];
};

export function safeGoogleUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && /(^|\.)(google\.com|googleusercontent\.com|gstatic\.com|goo\.gl)$/.test(url.hostname)) return url.href;
  } catch {}
  return undefined;
}
