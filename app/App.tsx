import Layout, { metadata as homeMetadata } from './layout';
import Home from './page';
import AdminPage from './admin/page';
import NotFound from './not-found';
import { seo, type Metadata } from '../lib/seo';

type Route = { content: React.ReactNode; metadata: Metadata; status: number; bare?: boolean; noIndex?: boolean };

export function resolveRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { content: <Home/>, metadata: homeMetadata, status: 200 };
  if (path === '/admin') return {
    content: <AdminPage/>,
    metadata: seo('Salon Admin | NG Aesthetics & Beauty Lab', 'Secure booking and availability management for NG Aesthetics & Beauty Lab.', '/admin'),
    status: 200,
    bare: true,
    noIndex: true,
  };
  return {
    content: <NotFound/>,
    metadata: seo('Page not found | NG Aesthetics & Beauty Lab', 'This page could not be found. Return to our beauty salon website.', path),
    status: 404,
    noIndex: true,
  };
}

export default function App({ pathname }: { pathname: string }) {
  const route = resolveRoute(pathname);
  return route.bare ? route.content : <Layout>{route.content}</Layout>;
}