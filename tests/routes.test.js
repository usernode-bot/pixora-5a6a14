const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROUTES, routeForPath } = require('../public/js/routes.js');

test('every route resolves to itself, and the table is sane', () => {
  assert.strictEqual(ROUTES.length, 6);
  const paths = new Set(ROUTES.map((r) => r.path));
  const views = new Set(ROUTES.map((r) => r.view));
  assert.strictEqual(paths.size, 6, 'route paths are unique');
  assert.strictEqual(views.size, 6, 'route views are unique');
  for (const route of ROUTES) {
    const found = routeForPath(route.path);
    assert.ok(found, route.path + ' resolves');
    assert.strictEqual(found.path, route.path);
    assert.strictEqual(found.view, route.view);
    assert.strictEqual(found.title, route.title);
  }
  assert.strictEqual(ROUTES[0].path, '/');
  assert.strictEqual(ROUTES[0].view, 'batch', '/ is Batch convert');
});

test('a trailing slash and a query still resolve', () => {
  assert.strictEqual(routeForPath('/creative/').view, 'creative');
  assert.strictEqual(routeForPath('/remove-background/').view, 'remove-background');
  assert.strictEqual(routeForPath('/creative?x=1').view, 'creative');
  assert.strictEqual(routeForPath('/prompt-generator/?a=b#c').view, 'prompt-generator');
});

test('unknown paths return null', () => {
  assert.strictEqual(routeForPath('/nope'), null);
  assert.strictEqual(routeForPath('/creative/extra'), null);
  assert.strictEqual(routeForPath('/upscale/deep/path'), null);
  assert.strictEqual(routeForPath(''), null);
});

test('the markup agrees with the route table', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const route of ROUTES) {
    assert.ok(html.includes('data-view="' + route.view + '"'), 'section for ' + route.view);
    assert.ok(html.includes('href="' + route.path + '"'), 'nav link for ' + route.path);
  }
  for (const id of ['drop-zone', 'queue', 'zip-btn', 'row-template']) {
    assert.ok(html.includes('id="' + id + '"'), 'Batch convert keeps #' + id);
  }
});