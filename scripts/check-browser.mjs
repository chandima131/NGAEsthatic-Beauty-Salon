import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('outputs/qa',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 for(const width of [375,390,430,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ['/','/prices','/contact','/treatments/skin-boosters','/gallery']){
   await page.goto('http://localhost:3000'+route,{waitUntil:'networkidle'});
   const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(size.scroll<=size.width,`${route} overflows at ${width}: ${JSON.stringify(size)}`);
   const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));assert.deepEqual(broken,[],`Broken images at ${route}`);
   if((width===390||width===1440)&&route==='/')await page.screenshot({path:`outputs/qa/home-${width}.png`,fullPage:true});
  }
  console.log(`PASS responsive ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});
 const menu=page.getByRole('button',{name:'Menu'});await menu.click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Prices',exact:true}).click();await page.waitForURL('**/prices');assert.equal(await page.locator('h1').textContent(),'A little luxury. Clearly priced.');
 const facial=page.locator('details#facials');await facial.locator('summary').click();assert.equal(await facial.getAttribute('open'),null);await facial.locator('summary').click();assert.notEqual(await facial.getAttribute('open'),null);
 await page.goto('http://localhost:3000/contact',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Prepare WhatsApp Enquiry'}).click();assert.equal(await page.getByRole('link',{name:'Continue to WhatsApp'}).count(),0);
 await page.getByLabel('Name',{exact:false}).fill('Test Visitor');await page.getByLabel('Phone',{exact:false}).fill('07800 000000');await page.getByLabel('Email',{exact:false}).fill('visitor@example.com');await page.getByLabel('Treatment Interested In').selectOption({label:'Facials'});await page.getByLabel('Message',{exact:false}).fill('Test enquiry only');await page.getByRole('button',{name:'Prepare WhatsApp Enquiry'}).click();const href=await page.getByRole('link',{name:'Continue to WhatsApp'}).getAttribute('href');assert.ok(href.startsWith('https://wa.me/447801247820?text='));assert.ok(decodeURIComponent(href).includes('Test Visitor'));await page.getByLabel('Name',{exact:false}).fill('Changed Visitor');assert.equal(await page.getByRole('link',{name:'Continue to WhatsApp'}).count(),0);
 // Do not follow WhatsApp, send a message, load Google Maps or submit to any third party.
 console.log('PASS mobile navigation, price accordion, form validation, WhatsApp preparation and stale-draft reset');
 const reports=[];
 for(const route of ['/','/prices','/contact','/gallery','/treatments/facials']){await page.goto('http://localhost:3000'+route,{waitUntil:'networkidle'});const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();reports.push({route,violations:results.violations});console.log(`Accessibility ${route}: ${results.violations.length} violations`);}
 await writeFile('outputs/qa/accessibility.json',JSON.stringify(reports,null,2));assert.equal(reports.flatMap(r=>r.violations).length,0,'Accessibility violations; inspect report');assert.deepEqual(errors,[],'Browser runtime errors');
 console.log('PASS browser checks');
}finally{await browser.close()}
