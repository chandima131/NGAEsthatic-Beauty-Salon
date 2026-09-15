import Header from '../components/Header';
import { Footer } from '../components/Site';
import { seo } from '../lib/seo';

export const metadata = seo(
  'NG Aesthetics & Beauty Lab | Beauty Treatments Hyde',
  'Discover beauty and aesthetic treatments in Hattersley, Hyde. View prices, see live appointment availability and request your booking online.',
  '/',
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><Header/>{children}<Footer/></>;
}