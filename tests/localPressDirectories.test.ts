import assert from 'node:assert/strict';
import test from 'node:test';
import { localPressDirectory, PRESS_DIRECTORY_COUNTRIES, WORLD_PRESS_INDEX } from '../src/data/localPressDirectories';
import { HEADLINE_PUBLISHERS, MORE_WORLD_NEWS_LINKS, WORLD_HEADLINE_PUBLISHERS } from '../src/data/homeHeadlineEditions';
import { countryPressCards, WORLD_PRESS_CARDS } from '../src/data/pressShowcase';
import { COUNTRY_CODES } from '../src/utils/pricing';

const hosts = (country: string) => localPressDirectory(country)?.links.map(([, url]) => new URL(url).hostname);

test('local press shows an entry country’s own publishers, not nearby countries or a different language edition', () => {
  assert.ok(hosts('EG')?.includes('gate.ahram.org.eg'));
  assert.ok(hosts('SA')?.includes('www.alriyadh.com'));
  assert.ok(hosts('AE')?.includes('www.albayan.ae'));
  assert.ok(hosts('FR')?.includes('www.lemonde.fr'));
  assert.ok(hosts('GB')?.includes('www.scotsman.com'));
  assert.ok(hosts('BR')?.includes('agenciabrasil.ebc.com.br'));
  assert.ok(hosts('BW')?.includes('www.mmegi.bw'));
  assert.ok(hosts('JP')?.includes('www.asahi.com'));
  assert.ok(hosts('HK')?.includes('hongkongfp.com'));
  assert.ok(hosts('PR')?.includes('www.elnuevodia.com'));
  assert.ok(hosts('GP')?.includes('www.guadeloupe.franceantilles.fr'));
  for (const code of ['SA', 'AE', 'JP', 'BW', 'BR', 'FR', 'GB', 'PR']) assert.ok(!hosts(code)?.includes('gate.ahram.org.eg'));
  assert.ok(!hosts('CG')?.includes('actualite.cd'));
  assert.equal(localPressDirectory('CD')?.more, `${WORLD_PRESS_INDEX}congo/`);
  assert.notEqual(localPressDirectory('CG')?.more, localPressDirectory('CD')?.more);
});

test('press directories use exact country links and do not guess for an unknown entry', () => {
  const andorra = localPressDirectory('AD');
  assert.deepEqual(andorra, { links: [], more: `${WORLD_PRESS_INDEX}andorra/` });
  assert.equal(localPressDirectory('JP')?.more, `${WORLD_PRESS_INDEX}japan/`);
  assert.equal(localPressDirectory('GB')?.more, `${WORLD_PRESS_INDEX}uk/`);
  for (const absent of [null, 'ZZ', 'eg', 'AQ', 'constructor', '__proto__']) assert.equal(localPressDirectory(absent), undefined);
});

test('the bundled links cover a broad range of entries with unique, plain HTTPS links', () => {
  const directories = COUNTRY_CODES.flatMap((code) => localPressDirectory(code) ?? []);
  assert.ok(directories.length >= 240, 'keep a country-specific route to the press for most recognized entries');
  assert.ok(directories.filter(({ links }) => links.length).length >= 180, 'keep a browsable list of publishers within the news panel');
  const countryIndexes = new Set<string>();
  for (const { links, more } of directories) {
    const seen = new Set<string>();
    for (const [name, href] of links) {
      const url = new URL(href);
      assert.ok(name.trim() === name && name.length > 0);
      assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname.includes('.') && !url.username && !url.password && !url.port && !url.search && !url.hash);
      assert.ok(!seen.has(url.href), `Duplicate outlet: ${href}`);
      seen.add(url.href);
    }
    if (more) {
      assert.ok(more.startsWith(WORLD_PRESS_INDEX) && /^[-a-z]+\/$/.test(more.slice(WORLD_PRESS_INDEX.length)));
      assert.ok(!countryIndexes.has(more), `Multiple countries point to ${more}`);
      countryIndexes.add(more);
    }
  }
});

test('the picture guide includes every listed publisher independently of feed availability', () => {
  assert.deepEqual(new Set(PRESS_DIRECTORY_COUNTRIES), new Set(COUNTRY_CODES.filter((country) => localPressDirectory(country))));
  for (const country of PRESS_DIRECTORY_COUNTRIES) {
    const directory = localPressDirectory(country)!;
    assert.deepEqual(countryPressCards(country).map(({ url }) => url), directory.links.map(([, url]) => url));
  }
  assert.deepEqual(countryPressCards(null), [], 'unknown entry never assigns a country');
  assert.deepEqual(countryPressCards('AD'), [], 'an external index is not a publisher');
  const world = WORLD_PRESS_CARDS.map(({ url }) => url);
  assert.deepEqual(new Set(world), new Set([
    ...MORE_WORLD_NEWS_LINKS.map(({ url }) => url),
    ...WORLD_HEADLINE_PUBLISHERS.map((publisher) => HEADLINE_PUBLISHERS[publisher].page),
  ]));
  assert.equal(world.length, new Set(world).size);
  for (const href of world) {
    const { protocol, username, password, port, search, hash } = new URL(href);
    assert.equal(protocol, 'https:');
    assert.ok(!username && !password && !port && !search && !hash);
  }
});
