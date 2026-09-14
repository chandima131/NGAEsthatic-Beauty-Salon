import assert from 'node:assert/strict';

globalThis.MessageChannel = undefined;
const { default: worker } = await import('../dist/server/index.js');
const env = { ASSETS: { fetch: async () => new Response('asset') } };
const page = await worker.fetch(new Request('https://example.test/'), env);
assert.equal(page.status, 200);
const html = await page.text();
for (const id of ['home','about','services','gallery','location','reviews','contact']) assert.match(html, new RegExp(`id="${id}"`));
const oldPage = await worker.fetch(new Request('https://example.test/contact'), env);
assert.equal(oldPage.status, 301);
assert.equal(oldPage.headers.get('location'), '/#contact');
const asset = await worker.fetch(new Request('https://example.test/images/logo.jpg'), env);
assert.equal(await asset.text(), 'asset');
assert.deepEqual(await (await worker.fetch(new Request('https://example.test/api/google-reviews'), env)).json(), { error: 'Not found' });
console.log('PASS: Sites adapter, single-page rendering, section redirects and static asset delegation.');