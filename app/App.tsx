import Layout, { metadata as homeMetadata } from './layout';
import Home from './page';
import NotFound from './not-found';
import { seo, type Metadata } from '../lib/seo';

export function resolveRoute(pathname: string): { content: React.ReactNode; metadata: Metadata; status: number } {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { content: <Home/>, metadata: homeMetadata, status: 200 };
  return {
    content: <NotFound/>,
    metadata: seo('Page not found | NG Aesthetics & Beauty Lab', 'This page could not be found. Return to our single-page beauty salon website.', path),
    status: 404,
  };
}

export default function App({ pathname }: { pathname: string }) {
  return <Layout>{resolveRoute(pathname).content}</Layout>;
}