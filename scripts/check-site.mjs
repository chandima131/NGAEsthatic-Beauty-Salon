import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { categories } from '../lib/services.ts';

const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
const expected = {
  facials:[45,60,80,45,50,65,50,35,45],
  'skin-boosters':[90,180,250],
  'fat-dissolving':[60,100,140,100,175,250],
  'chemical-peels':[60],
  'beauty-treatments':[6,6,20],
  makeup:[30,250,40],
  'threading-tinting':[15,8,3],
  waxing:[50,20,12,12,8,15,6,3],
  'vitamin-b12':[20,35],
};
for (const category of categories) assert.deepEqual(category.treatments.map(treatment => treatment.price), expected[category.slug], `Prices differ from business brief: ${category.slug}`);
const treatments = categories.flatMap(category => category.treatments);
assert.equal(treatments.length, 38);
assert.ok(treatments.every(treatment => treatment.durationMinutes >= 15 && treatment.durationMinutes <= 120 && treatment.durationMinutes % 15 === 0));

const response = await fetch(origin);
assert.equal(response.status, 200);
const html = await response.text();
assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, 'Homepage needs one H1');
for (const id of ['home','about','services','booking','gallery','location','reviews','contact','privacy']) assert.match(html, new RegExp('id="' + id + '"'), 'Missing #' + id);
const ordered = ['id="home"','id="about"','id="services"','id="booking"','id="gallery"','id="location"','id="reviews"','id="contact"'];
for (let index = 1; index < ordered.length; index++) assert.ok(html.indexOf(ordered[index]) > html.indexOf(ordered[index - 1]), `Section order: ${ordered[index]}`);
for (const field of ['og:title','og:description','og:image','twitter:card','twitter:title','twitter:description','twitter:image']) assert.ok(html.includes(`"${field}"`), field);
assert.match(html, /<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/ng-aesthetics-beauty-lab\.chandi131\.chatgpt\.site\/")[^>]*>/);
const schemaMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
assert.ok(schemaMatch);
const schema = JSON.parse(schemaMatch[1]);
assert.equal(schema['@type'], 'BeautySalon');
assert.equal(schema.telephone, '+44 7801 247820');
assert.equal(schema.address.postalCode, 'SK14 3FX');
assert.ok(!schema.openingHours && !schema.aggregateRating);
for (const category of categories) {
  assert.ok(html.includes(`id="prices-${category.slug}"`));
  for (const treatment of category.treatments) {
    assert.ok(html.includes(treatment.name.replaceAll('&','&amp;')), treatment.name);
    assert.ok(html.includes(String.fromCharCode(163) + treatment.price), treatment.name + ' price');
  }
}
for (const match of html.matchAll(/<img\b[^>]*>/g)) {
  assert.match(match[0], /alt="[^"]*"/);
  assert.match(match[0], /width="\d+"/);
  assert.match(match[0], /height="\d+"/);
  const src = match[0].match(/src="([^"]+)"/)?.[1];
  if (src?.startsWith('/')) assert.equal((await fetch(origin + src)).status, 200, src);
}
for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
  if (href.startsWith('#')) assert.ok(html.includes(`id="${href.slice(1)}"`), `Broken anchor ${href}`);
  if (href.startsWith('tel:')) assert.equal(href, 'tel:+447801247820');
  if (href.startsWith('https://wa.me/')) assert.ok(href.startsWith('https://wa.me/447801247820?text='));
}
assert.ok(!/lorem ipsum|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢|ÃƒÂ¢Ã¢â‚¬Â |ÃƒÂ¢Ã…â€œ|Ãƒâ€šÃ‚Â£|Ã¯Â¿Â½/i.test(html), 'Placeholder or encoding issue');
const redirects = {'/about':'/#about','/treatments':'/#services','/prices':'/#services','/gallery':'/#gallery','/contact':'/#contact','/privacy':'/#privacy','/treatments/facials':'/#services'};
for (const [path, location] of Object.entries(redirects)) {
  const redirect = await fetch(origin + path, { redirect: 'manual' });
  assert.equal(redirect.status, 301, path);
  assert.equal(redirect.headers.get('location'), location, path);
}
const sitemap = await (await fetch(origin + '/sitemap.xml')).text();
assert.equal((sitemap.match(/<url>/g) || []).length, 1);
assert.ok(sitemap.includes('https://ng-aesthetics-beauty-lab.chandi131.chatgpt.site/'));
const admin = await fetch(origin + '/admin');
assert.equal(admin.status, 200);
assert.match(await admin.text(), /noindex, nofollow/);
const robotsText = await (await fetch(origin + '/robots.txt')).text();
assert.match(robotsText, /Disallow: \/admin/);
assert.match(robotsText, /Disallow: \/api\//);
assert.equal((await fetch(origin + '/missing-page')).status, 404);
const adminSource = await readFile('components/AdminPanel.tsx', 'utf8');
assert.ok(!adminSource.includes('Add available slots') && !adminSource.includes('/api/admin/slots'));
assert.match(adminSource, /Add a customer booking/);
assert.match(adminSource, /booked through WhatsApp/i);
assert.match(adminSource, /Monday to Sunday/);
const calendarSource = await readFile('components/BookingCalendar.tsx', 'utf8');
assert.match(calendarSource, /CHOOSE A TREATMENT/);
assert.match(calendarSource, /10:00–22:00/);
const css = await readFile('app/globals.css','utf8');
for (const colour of ['#EC9EB8','#DC7097','#D53B70','#B92A58','#8B2257','#691936','#46121F']) assert.ok(css.includes(colour), colour);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/:focus-visible/);
for (const dir of ['app','components','lib']) for (const path of await readdir(dir,{recursive:true})) {
  if (!/\.(tsx?|css)$/.test(path)) continue;
  const source = await readFile(`${dir}/${path}`,'utf8');
  assert.ok(!/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢|ÃƒÂ¢Ã¢â‚¬Â |ÃƒÂ¢Ã…â€œ|Ãƒâ€šÃ‚Â£|Ã¯Â¿Â½/.test(source), `Encoding ${dir}/${path}`);
}
console.log('PASS: one page, 38 supplied prices and realistic durations, automatic-hours booking UI, metadata, assets, and pink palette.');
