import { hydrateRoot } from 'react-dom/client';
import App from '../app/App';
import '../app/globals.css';

hydrateRoot(document.getElementById('root')!, <App pathname={window.location.pathname}/>);

const loader = document.getElementById('page-loader');
let loaderClosed = false;

function closeLoader() {
  if (!loader || loaderClosed) return;
  loaderClosed = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.remove('site-opening');
    loader.classList.add('is-hidden');
    window.setTimeout(() => loader.remove(), 450);
  }));
}

if (document.readyState === 'complete') closeLoader();
else window.addEventListener('load', closeLoader, { once: true });

window.setTimeout(closeLoader, 5000);
