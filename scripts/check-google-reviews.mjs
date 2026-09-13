import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, name => dependencies[name]);
  return exports;
}
const shared = load('lib/google-reviews.ts');
const { getGoogleReviews } = load('server/google-reviews.ts', { '../lib/google-reviews': shared });
const GET = () => getGoogleReviews(process.env);
const savedFetch = globalThis.fetch;
const savedKey = process.env.GOOGLE_MAPS_API_KEY;
const savedId = process.env.GOOGLE_PLACE_ID;
try {
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_PLACE_ID;
  globalThis.fetch = () => { throw Error('Must not fetch without configuration'); };
  assert.deepEqual(await (await GET()).json(), { available: false });
  process.env.GOOGLE_MAPS_API_KEY = 'TEST_ONLY_SECRET';
  process.env.GOOGLE_PLACE_ID = 'TEST_ONLY_ID';
  for (const scenario of ['error', 'timeout', 'malformed', 'empty', 'wrong-place']) {
    globalThis.fetch = async () => {
      if (scenario === 'timeout') throw Error('timeout TEST_ONLY_SECRET');
      if (scenario === 'error') return new Response('TEST_ONLY_SECRET', { status: 403 });
      if (scenario === 'malformed') return new Response('invalid json');
      return Response.json({ id: scenario === 'wrong-place' ? 'another' : 'TEST_ONLY_ID', rating: 4, userRatingCount: 1, reviews: scenario === 'wrong-place' ? [{ rating: 4 }] : [] });
    };
    const response = await GET();
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.deepEqual(await response.json(), { available: false });
  }
  globalThis.fetch = async (url, options) => {
    assert.match(url, /places.googleapis.com\/v1\/places\/TEST_ONLY_ID/);
    assert.equal(options.headers['X-Goog-Api-Key'], 'TEST_ONLY_SECRET');
    assert.equal(options.cache, 'no-store');
    return Response.json({ id: 'TEST_ONLY_ID', rating: 4, userRatingCount: 1, reviews: [{ name: 'test-only', originalText: { text: 'Test fixture only' }, authorAttribution: { displayName: 'Test fixture', uri: 'https://www.google.com/maps/contrib/test', photoUri: 'https://lh3.googleusercontent.com/test' }, rating: 4, publishTime: '2026-01-01T00:00:00Z' }] });
  };
  const response = await GET();
  const body = await response.json();
  assert.equal(body.available, true);
  assert.equal(body.data.reviews[0].text.text, 'Test fixture only');
  assert.equal(body.data.userRatingCount, 1);
  assert.equal(JSON.stringify(body).includes('TEST_ONLY_SECRET'), false);
  assert.match(body.data.writeReviewUrl, /placeid=TEST_ONLY_ID/);
  assert.equal(shared.safeGoogleUrl('javascript:alert(1)'), undefined);
  assert.equal(shared.safeGoogleUrl('https://google.com.attacker.test/'), undefined);
  console.log('PASS: missing config, upstream denial, timeout, malformed data, missing reviews, identity mismatch, successful mapping, no-store, secret exclusion and URL safety. Test fixtures are never served or deployed.');
} finally {
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = savedKey;
  if (savedId === undefined) delete process.env.GOOGLE_PLACE_ID; else process.env.GOOGLE_PLACE_ID = savedId;
}
