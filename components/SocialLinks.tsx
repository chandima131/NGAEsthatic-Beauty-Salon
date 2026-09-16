import { business } from '../lib/business';

const profiles = [
  { name: 'Facebook', href: business.facebook, icon: 'facebook' },
  { name: 'Instagram', href: business.instagram, icon: 'instagram' },
  { name: 'TikTok', href: business.tiktok, icon: 'tiktok' },
  { name: 'Stan Store', href: business.stanStore, icon: 'store' },
] as const;

function SocialIcon({ name }: { name: typeof profiles[number]['icon'] }) {
  if (name === 'facebook') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.8-.1-1.7-.2-2.5-.2c-2.5 0-4.2 1.5-4.2 4.3v2.2H8V13h2.8v8h3.4Z"/></svg>;
  if (name === 'instagram') return <svg viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M7.3 2.8h9.4a4.5 4.5 0 0 1 4.5 4.5v9.4a4.5 4.5 0 0 1-4.5 4.5H7.3a4.5 4.5 0 0 1-4.5-4.5V7.3a4.5 4.5 0 0 1 4.5-4.5Zm0 2A2.5 2.5 0 0 0 4.8 7.3v9.4a2.5 2.5 0 0 0 2.5 2.5h9.4a2.5 2.5 0 0 0 2.5-2.5V7.3a2.5 2.5 0 0 0-2.5-2.5H7.3Zm9.9 1.5a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 0 1 0-2.4ZM12 7.3a4.7 4.7 0 1 1 0 9.4a4.7 4.7 0 0 1 0-9.4Zm0 2a2.7 2.7 0 1 0 0 5.4a2.7 2.7 0 0 0 0-5.4Z"/></svg>;
  if (name === 'tiktok') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.3 3c.3 2.2 1.6 3.6 3.7 4v3.2a8.2 8.2 0 0 1-3.7-1.1v6.1a5.8 5.8 0 1 1-5-5.7v3.3a2.6 2.6 0 1 0 1.8 2.4V3h3.2Z"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="m4.1 8.1l1.5-4.3h12.8l1.5 4.3a3.3 3.3 0 0 1-1.2 3.7V21H5.3v-9.2a3.3 3.3 0 0 1-1.2-3.7Zm3-2.3l-.8 2.8a1.3 1.3 0 0 0 2.5.5l.7-3.3H7.1Zm4.4 0l-.2 3a1.3 1.3 0 0 0 2.6 0l-.2-3h-2.2Zm4.1 0l.7 3.3a1.3 1.3 0 0 0 2.5-.5L18 5.8h-2.4ZM7.3 12.1V19h9.4v-6.9a3.3 3.3 0 0 1-2.6-.8a3.3 3.3 0 0 1-4.2 0a3.3 3.3 0 0 1-2.6.8Z"/></svg>;
}

export default function SocialLinks({ labelled = false, className = '' }: { labelled?: boolean; className?: string }) {
  return <div className={'social-links' + (labelled ? ' social-links-labelled' : '') + (className ? ' ' + className : '')} aria-label="NG Aesthetics social links">
    {profiles.map(profile => <a className="social-link" href={profile.href} key={profile.name} target="_blank" rel="noopener noreferrer" aria-label={'Visit NG Aesthetics on ' + profile.name} title={profile.name}>
      <SocialIcon name={profile.icon}/>{labelled && <span>{profile.name}</span>}
    </a>)}
  </div>;
}
