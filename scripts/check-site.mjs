import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { categories } from '../lib/services.ts';
const origin=process.env.TEST_ORIGIN||'http://localhost:3000';
const expected={facials:[45,60,80,45,50,65,50,35,45],'skin-boosters':[90,180,250],'fat-dissolving':[60,100,140,100,175,250],'chemical-peels':[60],'beauty-treatments':[6,6,20],makeup:[30,250,40],'threading-tinting':[15,8,3],waxing:[50,20,12,12,8,15,6,3],'vitamin-b12':[20,35]};
for(const c of categories)assert.deepEqual(c.treatments.map(t=>t.price),expected[c.slug],`Prices differ from business brief: ${c.slug}`);
assert.equal(categories.flatMap(c=>c.treatments).length,38);
const paths=['/','/about','/treatments','/prices','/gallery','/contact','/privacy','/cookies','/terms',...categories.map(c=>`/treatments/${c.slug}`)];
const links=new Set(), assets=new Set();
for(const path of paths){
 const res=await fetch(origin+path);assert.equal(res.status,200,path);const html=await res.text();
 assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,`${path} needs one H1`);
 assert.match(html,/<title>[^<]+<\/title>/,`${path} title`);
 assert.match(html,/<meta(?=[^>]*name="description")(?=[^>]*content="[^"]+")[^>]*>/,`${path} description`);
 assert.match(html,/<link(?=[^>]*rel="canonical")(?=[^>]*href="https:\/\/ng-aesthetics-beauty-lab.chandi131.chatgpt.site)[^>]*>/,`${path} canonical`);
 for(const field of ['og:title','og:description','og:image','twitter:card','twitter:title','twitter:description','twitter:image'])assert.ok(html.includes(`"${field}"`),`${path} ${field}`);
 const schemaMatch=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);assert.ok(schemaMatch,`${path} schema`);const schema=JSON.parse(schemaMatch[1]);assert.equal(schema['@type'],'BeautySalon');assert.equal(schema.telephone,'+44 7801 247820');assert.equal(schema.address.postalCode,'SK14 3FX');assert.ok(!schema.openingHours && !schema.aggregateRating);
 for(const match of html.matchAll(/<img\b[^>]*>/g)){assert.match(match[0],/alt="[^"]+"/,`${path} image alt`);assert.match(match[0],/width="\d+"/,`${path} image width`);assert.match(match[0],/height="\d+"/,`${path} image height`);const src=match[0].match(/src="([^"]+)"/);if(src?.[1].startsWith('/'))assets.add(src[1]);}
 for(const [,href] of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){if(href.startsWith('/')&&!href.startsWith('//'))links.add(href.split('#')[0]);if(href.startsWith('tel:'))assert.equal(href,'tel:+447801247820');if(href.startsWith('https://wa.me/'))assert.ok(href.startsWith('https://wa.me/447801247820?text='));}
 assert.ok(!/lorem ipsum|â€™|â†|�/i.test(html),`${path} placeholder or encoding issue`);
 if(path.startsWith('/treatments/')){const c=categories.find(c=>path.endsWith(c.slug));assert.ok(html.includes(`${c.name.replaceAll('&','&amp;')} in Hyde |`),`${path} correct detail title`);assert.ok(html.includes(`/images/${c.image}.webp`),`${path} correct social image`);}
 console.log(`PASS ${path}`);
}
for(const path of [...links,...assets]){const res=await fetch(origin+path);assert.equal(res.status,200,`Broken local link/asset ${path}`);await res.body?.cancel();}
const sitemap=await (await fetch(origin+'/sitemap.xml')).text();assert.match(sitemap,/<urlset/);for(const path of paths)assert.ok(sitemap.includes('https://ng-aesthetics-beauty-lab.chandi131.chatgpt.site'+path),`Missing sitemap ${path}`);
const robots=await (await fetch(origin+'/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/ng-aesthetics-beauty-lab.chandi131.chatgpt.site\/sitemap.xml/);
assert.equal((await fetch(origin+'/treatments/nonexistent-treatment')).status,404);
const css=await readFile('app/globals.css','utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/:focus-visible/);assert.match(css,/@media\(max-width:600px\)/);
const fontCss=await readFile('public/fonts/fonts.css','utf8');assert.ok(!fontCss.includes('https://'));for(const [,path] of fontCss.matchAll(/url\(([^)]+)\)/g))assert.equal((await fetch(origin+path)).status,200);
for(const dir of ['app','components','lib'])for(const path of await readdir(dir,{recursive:true})){if(!/\.(tsx?|css)$/.test(path))continue;const src=await readFile(`${dir}/${path}`,'utf8');assert.ok(!/â€™|â†|�/.test(src),`Encoding ${path}`);}
console.log(`PASS: 38 supplied prices, ${paths.length} pages, ${links.size} links, ${assets.size} image assets, schema, metadata, sitemap, robots and source checks.`);
