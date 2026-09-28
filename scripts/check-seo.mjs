const localBase = process.argv[2] ?? 'http://127.0.0.1:3000';
const canonicalBase = 'https://dynasaurus.rkrk.io';

const publicPages = [
  '/',
  '/intro',
  '/method/rua',
  '/about',
  '/faq',
  '/mini',
  '/pricing',
  '/privacy',
];

const failures = [];
const titles = new Map();

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

for (const pathname of publicPages) {
  const response = await fetch(new URL(pathname, localBase));
  const html = await response.text();
  const expectedCanonical = `${canonicalBase}${pathname === '/' ? '' : pathname}`;
  const title = firstMatch(html, /<title[^>]*>([^<]+)<\/title>/i);
  const canonical = firstMatch(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const description = firstMatch(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const robots = firstMatch(html, /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const ogImage = firstMatch(html, /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);

  assert(response.status === 200, `${pathname}: expected 200, received ${response.status}`);
  assert(Boolean(title), `${pathname}: missing title`);
  assert(Boolean(description), `${pathname}: missing meta description`);
  assert(canonical === expectedCanonical, `${pathname}: canonical is ${canonical || 'missing'}, expected ${expectedCanonical}`);
  assert(!/noindex/i.test(robots), `${pathname}: unexpectedly noindex`);
  assert(Boolean(ogImage), `${pathname}: missing og:image`);

  if (title) {
    const priorPath = titles.get(title);
    assert(!priorPath, `${pathname}: duplicate title also used by ${priorPath}: ${title}`);
    titles.set(title, pathname);
  }
}

const robotsResponse = await fetch(new URL('/robots.txt', localBase));
const robotsText = await robotsResponse.text();
assert(robotsResponse.status === 200, `/robots.txt: expected 200, received ${robotsResponse.status}`);
assert(/Disallow:\s*\/api\b/i.test(robotsText), '/robots.txt: /api is not disallowed');
assert(/Disallow:\s*\/admin\b/i.test(robotsText), '/robots.txt: /admin is not disallowed');
assert(robotsText.includes(`${canonicalBase}/sitemap.xml`), '/robots.txt: canonical sitemap URL missing');

const sitemapResponse = await fetch(new URL('/sitemap.xml', localBase));
const sitemapText = await sitemapResponse.text();
assert(sitemapResponse.status === 200, `/sitemap.xml: expected 200, received ${sitemapResponse.status}`);
for (const pathname of publicPages) {
  const expectedUrl = `${canonicalBase}${pathname === '/' ? '' : pathname}`;
  assert(sitemapText.includes(`<loc>${expectedUrl}</loc>`), `/sitemap.xml: missing ${expectedUrl}`);
}

const authResponse = await fetch(new URL('/auth/login', localBase));
const authHtml = await authResponse.text();
assert(/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(authHtml), '/auth/login: noindex missing');

const legacyIntro = await fetch(new URL('/intro.html', localBase), { redirect: 'manual' });
assert([301, 308].includes(legacyIntro.status), `/intro.html: expected permanent redirect, received ${legacyIntro.status}`);
assert(legacyIntro.headers.get('location') === '/intro', `/intro.html: redirect target is ${legacyIntro.headers.get('location')}`);

const socialImage = await fetch(new URL('/opengraph-image', localBase));
assert(socialImage.status === 200, `/opengraph-image: expected 200, received ${socialImage.status}`);
assert((socialImage.headers.get('content-type') ?? '').startsWith('image/'), '/opengraph-image: image content type missing');

if (failures.length) {
  console.error(`SEO smoke test failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SEO smoke test passed for ${publicPages.length} public pages at ${localBase}`);
