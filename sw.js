const VERSION = 'qarie-v4';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css?v=4',
  './js/util.js?v=4', './js/db.js?v=4', './js/settings.js?v=4', './js/ai.js?v=4',
  './js/tts.js?v=4', './js/viewer.js?v=4', './js/library.js?v=4', './js/dictionary.js?v=4',
  './js/study.js?v=4', './js/sync.js?v=4', './js/backup.js?v=4', './js/app.js?v=4',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'
];
const CDN = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/docx-preview@0.3.2/dist/docx-preview.min.js',
  'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))).catch(() => {});
    await Promise.allSettled(CDN.map((u) => cache.add(new Request(u, { mode: 'cors' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'clearRuntime') caches.delete(VERSION);
});

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req, { ignoreSearch: false });
  const network = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  }).catch(() => null);
  if (cached) return cached;
  const res = await network;
  return res || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(new URL('./index.html', self.location).href, copy)).catch(() => {});
        return res;
      } catch (err) {
        const cached = await caches.match(new URL('./index.html', self.location).href);
        return cached || Response.error();
      }
    })());
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const knownCdn = sameOrigin || /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|tessdata\.projectnaptha\.com|unpkg\.com)$/.test(url.hostname);
  if (!knownCdn) return;
  e.respondWith(staleWhileRevalidate(req));
});
