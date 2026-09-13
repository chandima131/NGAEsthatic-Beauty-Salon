import { hydrateRoot } from 'react-dom/client';
import App from '../app/App';
import '../app/globals.css';

hydrateRoot(document.getElementById('root')!, <App pathname={window.location.pathname}/>);
