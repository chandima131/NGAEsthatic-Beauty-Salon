export type Metadata = {
  title: string; description: string;
  alternates: { canonical: string };
  openGraph: { title: string; description: string; url: string; siteName: string; locale: string; type: string; images: { url: string; width?: number; height?: number; alt: string }[] };
  twitter: { card: string; title: string; description: string; images: string[] };
};
import { business } from './business';
export function seo(title:string,description:string,path:string):Metadata {const url=new URL(path,business.siteUrl).toString();const image=new URL('/og.png',business.siteUrl).toString();return {title,description,alternates:{canonical:url},openGraph:{title,description,url,siteName:business.name,locale:'en_GB',type:'website',images:[{url:image,width:1733,height:907,alt:business.name}]},twitter:{card:'summary_large_image',title,description,images:[image]}};}
export const salonSchema={'@context':'https://schema.org','@type':'BeautySalon',name:business.name,telephone:business.phone,address:{'@type':'PostalAddress',streetAddress:'Sgt Mark Stansfield Way',addressLocality:'Hattersley, Hyde',postalCode:'SK14 3FX',addressCountry:'GB'},sameAs:[business.instagram],areaServed:['Hattersley','Hyde']};
