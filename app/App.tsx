import Layout, { metadata as homeMetadata } from './layout';
import Home from './page';
import * as About from './about/page';
import * as Treatments from './treatments/page';
import * as Prices from './prices/page';
import * as Gallery from './gallery/page';
import * as Contact from './contact/page';
import * as Privacy from './privacy/page';
import * as Cookies from './cookies/page';
import * as Terms from './terms/page';
import Treatment, { treatmentMetadata } from './treatments/[slug]/page';
import NotFound from './not-found';
import { seo, type Metadata } from '../lib/seo';
import type { ComponentType } from 'react';

const pages: Record<string, { default: ComponentType; metadata: Metadata }> = {
  '/': { default: Home, metadata: homeMetadata },
  '/about': About, '/treatments': Treatments, '/prices': Prices,
  '/gallery': Gallery, '/contact': Contact, '/privacy': Privacy,
  '/cookies': Cookies, '/terms': Terms,
};
export function resolveRoute(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = pages[path];
  if (page) return { content: <page.default/>, metadata: page.metadata, status: 200 };
  const match = /^\/treatments\/([^/]+)$/.exec(path);
  const metadata = match && treatmentMetadata(match[1]);
  if (match && metadata) return { content: <Treatment slug={match[1]}/>, metadata, status: 200 };
  return { content: <NotFound/>, metadata: seo('Page not found | NG Aesthetics & Beauty Lab', 'This page could not be found. Explore our beauty treatments or contact the salon.', path), status: 404 };
}
export default function App({ pathname }: { pathname: string }) {
  return <Layout pathname={pathname.replace(/\/+$/, '') || '/'}>{resolveRoute(pathname).content}</Layout>;
}
