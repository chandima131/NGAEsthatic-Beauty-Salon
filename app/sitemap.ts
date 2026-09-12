import { business } from '../lib/business';
import { categories } from '../lib/services';
export default function sitemap(){return ['','/about','/treatments','/prices','/gallery','/contact','/privacy','/cookies','/terms',...categories.map(c=>`/treatments/${c.slug}`)].map(path=>({url:new URL(path||'/',business.siteUrl).toString(),changeFrequency:'monthly' as const,priority:path===''?1:0.7}))}
