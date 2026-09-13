import assert from 'node:assert/strict';

// Sites lacks the browser MessageChannel global. Verify the portable server
// bundle imports and renders without it, then serves assets through its binding.
globalThis.MessageChannel = undefined;
const { default: worker } = await import('../dist/server/index.js');
const env = { ASSETS: { fetch: async () => new Response('asset') } };
const page = await worker.fetch(new Request('https://example.test/contact'), env);
assert.equal(page.status, 200);
assert.match(await page.text(), /Your beauty moment awaits/);
const asset = await worker.fetch(new Request('https://example.test/images/logo.jpg'), env);
assert.equal(await asset.text(), 'asset');
assert.deepEqual(await (await worker.fetch(new Request('https://example.test/api/google-reviews'), env)).json(), { error: 'Not found' });
console.log('PASS: Sites adapter rendering, static asset delegation and retired reviews endpoint.');
