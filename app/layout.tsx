import Header from '../components/Header';
import { Footer } from '../components/Site';
import { seo } from '../lib/seo';

export const metadata = seo(
  'NG Aesthetics & Beauty Lab | Beauty Treatments Hyde',
  'Discover facials, skin treatments, makeup, waxing and threading at NG Aesthetics & Beauty Lab in Hattersley, Hyde. View prices and book by WhatsApp.',
  '/',
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return <><Header/>{children}<Footer/></>;
}