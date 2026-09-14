import { business } from '../lib/business';

export default function sitemap() {
  return [{ url: new URL('/', business.siteUrl).toString(), changeFrequency: 'weekly' as const, priority: 1 }];
}