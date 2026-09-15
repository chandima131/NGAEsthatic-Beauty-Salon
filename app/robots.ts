import { business } from '../lib/business';

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: new URL('/sitemap.xml', business.siteUrl).toString(),
  };
}