// Pixora's page addresses. One HTML document holds every page; the path in
// the address bar picks which section is visible. Unknown paths fall back to
// Batch convert, the page Pixora opens on.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PixoraRoutes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // In sidebar order.
  const ROUTES = [
    { path: '/', view: 'batch', title: 'Batch convert', group: 'Utilities' },
    { path: '/creative', view: 'creative', title: 'Creative', group: 'AI tools' },
    { path: '/upscale', view: 'upscale', title: 'Upscale Image', group: 'AI tools' },
    { path: '/remove-background', view: 'remove-background', title: 'Remove Background', group: 'AI tools' },
    { path: '/metadata', view: 'metadata', title: 'Metadata AI', group: 'AI tools' },
    { path: '/prompt-generator', view: 'prompt-generator', title: 'Prompt Generator', group: 'AI tools' },
  ];

  function routeForPath(pathname) {
    let p = String(pathname || '');
    const query = p.indexOf('?');
    if (query !== -1) p = p.slice(0, query);
    const hash = p.indexOf('#');
    if (hash !== -1) p = p.slice(0, hash);
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return ROUTES.find((r) => r.path === p) || null;
  }

  return { ROUTES: ROUTES, routeForPath: routeForPath };
});