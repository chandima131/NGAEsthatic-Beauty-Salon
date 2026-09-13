import { readFile, writeFile } from 'node:fs/promises';

// Node 22+: loads ignored local secrets, never prints the API key.
try { process.loadEnvFile('.env.local'); } catch {}
const key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) throw new Error('Set GOOGLE_MAPS_API_KEY in .env.local before resolving the Place ID.');
const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
  },
  body: JSON.stringify({
    textQuery: 'NG Aesthetics & Beauty Lab, Hattersley, Hyde, United Kingdom',
    languageCode: 'en',
    locationBias: { circle: { center: { latitude: 53.4483409, longitude: -2.0333377 }, radius: 500 } },
  }),
  signal: AbortSignal.timeout(10000),
});
if (!response.ok) throw new Error(`Places API search failed (HTTP ${response.status}). Check API enablement, billing and key restrictions.`);
const { places = [] } = await response.json();
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const matches = places.filter(place => {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  const distance = Math.hypot((lat - 53.4483409) * 111320, (lng + 2.0333377) * 111320 * Math.cos(53.4483409 * Math.PI / 180));
  return normalize(place.displayName?.text || '') === 'ngaestheticsbeautylab' && distance < 300;
});
if (matches.length !== 1) {
  console.log(JSON.stringify(places, null, 2));
  throw new Error('No unambiguous exact name and coordinate match. Confirm a candidate before storing its ID.');
}
const match = matches[0];
console.log(JSON.stringify(match, null, 2));
let env = await readFile('.env.local', 'utf8').catch(() => '');
const line = `GOOGLE_PLACE_ID=${match.id}`;
env = /^GOOGLE_PLACE_ID=.*$/m.test(env) ? env.replace(/^GOOGLE_PLACE_ID=.*$/m, line) : `${env}\n${line}\n`;
await writeFile('.env.local', env);
console.log('Verified Place ID saved to .env.local. Configure the same GOOGLE_PLACE_ID in Sites environment settings.');
