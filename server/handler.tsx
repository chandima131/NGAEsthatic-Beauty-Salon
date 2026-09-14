import { renderToString } from 'react-dom/server.edge';
import App, { resolveRoute } from '../app/App';
import { salonSchema, type Metadata } from '../lib/seo';
import sitemap from '../app/sitemap';
import robots from '../app/robots';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
function renderHead(metadata: Metadata, status: number) {
  const meta = (name: string, content: string, property = false) => `<meta ${property ? 'property' : 'name'}="${name}" content="${escape(content)}">`;
  return `<title>${escape(metadata.title)}</title>`
    + meta('description', metadata.description)
    + `<link rel="canonical" href="${escape(metadata.alternates.canonical)}">`
    + Object.entries({ 'og:title': metadata.openGraph.title, 'og:description': metadata.openGraph.description, 'og:url': metadata.openGraph.url, 'og:site_name': metadata.openGraph.siteName, 'og:locale': metadata.openGraph.locale, 'og:type': metadata.openGraph.type, 'og:image': metadata.openGraph.images[0].url, 'og:image:alt': metadata.openGraph.images[0].alt }).map(([key, value]) => meta(key, value, true)).join('')
    + Object.entries({ 'twitter:card': metadata.twitter.card, 'twitter:title': metadata.twitter.title, 'twitter:description': metadata.twitter.description, 'twitter:image': metadata.twitter.images[0] }).map(([key, value]) => meta(key, value)).join('')
    + (status === 404 ? meta('robots', 'noindex') : '')
    + `<script type="application/ld+json">${JSON.stringify(salonSchema).replace(/</g, '\\u003c')}</script>`;
}

const sectionRedirects: Record<string, string> = {
  '/about': '/#about', '/treatments': '/#services', '/prices': '/#services',
  '/gallery': '/#gallery', '/contact': '/#contact', '/privacy': '/#privacy',
  '/cookies': '/#privacy', '/terms': '/#privacy',
};

export async function handleRequest(request: Request, template: string): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const respond = (body: string, type: string, status = 200) => new Response(request.method === 'HEAD' ? null : body, { status, headers: { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
  if (pathname.startsWith('/api/')) return respond('{"error":"Not found"}', 'application/json', 404);
  if (pathname === '/robots.txt') {
    const data = robots();
    return respond(`User-agent: *\nAllow: /\nSitemap: ${data.sitemap}\n`, 'text/plain; charset=utf-8');
  }
  if (pathname === '/sitemap.xml') return respond(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap().map(item => `<url><loc>${escape(item.url)}</loc><changefreq>${item.changeFrequency}</changefreq><priority>${item.priority}</priority></url>`).join('')}</urlset>`, 'application/xml; charset=utf-8');
  if (/^\/(assets|images|fonts)\//.test(pathname) || pathname === '/og.png' || pathname === '/screenshot.jpeg') return null;
  const legacyTreatment = /^\/treatments\/[^/]+\/?$/.test(pathname);
  const redirect = legacyTreatment ? '/#services' : sectionRedirects[pathname.replace(/\/+$/, '') || '/'];
  if (redirect && pathname !== '/') return new Response(null, { status: 301, headers: { Location: redirect, 'Cache-Control': 'public, max-age=86400' } });
  const route = resolveRoute(pathname);
  const html = template.replace('<!--app-head-->', () => renderHead(route.metadata, route.status))
    .replace('<!--app-html-->', () => renderToString(<App pathname={pathname}/>));
  return respond(html, 'text/html; charset=utf-8', route.status);
}