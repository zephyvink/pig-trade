// PigTrade service worker: makes the web app work with NO internet after the
// first visit (farms may have no signal).
//
// How it works, in plain words:
//  * When the app is first opened online, this script downloads every file
//    the app needs (the list below) and keeps a copy in the browser.
//  * From then on, every request is answered from that copy first. The
//    network is only used for a file that is not in the copy yet.
//  * When a new version of the app is published, the file list and the
//    version name change (tool/build_web.ps1 writes them), so a new copy is
//    made in the background. The new version starts the next time the app is
//    closed completely and opened again.
//
// The two markers below are replaced by tool/build_web.ps1 after the build.
// (If you open this file straight from web/, the list is empty and the worker
// still caches files as they are used.)

const VERSION = 'cb3323442f24';
const PRECACHE = ["./","assets/AssetManifest.bin","assets/AssetManifest.bin.json","assets/assets/fonts/roboto-bold.ttf","assets/assets/fonts/roboto-medium.ttf","assets/assets/fonts/roboto-regular.ttf","assets/FontManifest.json","assets/fonts/MaterialIcons-Regular.otf","assets/NOTICES","assets/packages/cupertino_icons/assets/CupertinoIcons.ttf","assets/shaders/ink_sparkle.frag","assets/shaders/stretch_effect.frag","canvaskit/canvaskit.js","canvaskit/canvaskit.wasm","canvaskit/chromium/canvaskit.js","canvaskit/chromium/canvaskit.wasm","drift_worker.js","favicon.png","flutter.js","flutter_bootstrap.js","icons/apple-touch-icon.png","icons/Icon-192.png","icons/Icon-512.png","icons/Icon-maskable-192.png","icons/Icon-maskable-512.png","index.html","main.dart.js","manifest.json","sqlite3.wasm"];

const CACHE_NAME = 'pigtrade-' + VERSION;

// Every path is relative to where this file lives, so the app also works
// when it is hosted in a sub-folder (https://name.github.io/pigtrade/).
const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE.map(scopeUrl)))
  );
  // No skipWaiting(): a new version waits until the app is closed, so a
  // running app never mixes old and new files.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove the copies of older versions.
      for (const name of await caches.keys()) {
        if (name.startsWith('pigtrade-') && name !== CACHE_NAME) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch other sites

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        // Offline and not in the copy: opening the app address itself still
        // gets the app's start page.
        if (request.mode === 'navigate') {
          const home = await cache.match(scopeUrl('index.html'));
          if (home) return home;
        }
        throw error;
      }
    })()
  );
});
