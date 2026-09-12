export const business = {
name: 'NG Aesthetics & Beauty Lab',
phone: '+44 7801 247820', telephone: 'tel:+447801247820', whatsapp: 'https://wa.me/447801247820',
instagram: 'https://www.instagram.com/ngaestheticbeautylab/', instagramHandle: '@ngaestheticbeautylab',
address: 'Sgt Mark Stansfield Way, Hattersley, Hyde, SK14 3FX, United Kingdom',
mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sgt+Mark+Stansfield+Way+Hattersley+Hyde+SK14+3FX',
bookingUrl: '', siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://ng-aesthetics-beauty-lab.chandi131.chatgpt.site',
integrations: { ga4: '', searchConsole: '', metaPixel: '', googleBusinessProfile: '' },
};
export function bookingUrl(treatment?: string) { return business.bookingUrl || `${business.whatsapp}?text=${encodeURIComponent(`Hi NG Aesthetics & Beauty Lab, I'd like to enquire about booking ${treatment ? treatment : 'a treatment'}.`)}`; }
