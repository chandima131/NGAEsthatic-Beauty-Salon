import type { Metadata } from 'next';
import Header from '../components/Header';
import { Footer } from '../components/Site';
import { seo, salonSchema } from '../lib/seo';
import './globals.css';
export const metadata: Metadata = {...seo('NG Aesthetics & Beauty Lab | Beauty Treatments Hyde','Discover facials, skin treatments, makeup, waxing and threading at NG Aesthetics & Beauty Lab in Hattersley, Hyde. Call or message to book.','/'),icons:{icon:'/images/logo.jpg',apple:'/images/logo.jpg'}};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {return <html lang="en-GB"><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(salonSchema).replace(/</g,'\\u003c')}}/><Header/>{children}<Footer/></body></html>}
