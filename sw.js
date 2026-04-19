const CACHE_NAME = 'redeterminaciones-v1.3';

const ARCHIVOS = [
    '/',
    '/index.html',
    '/css/base.css',
    '/css/components.css',
    '/css/screens.css',
    '/js/config.js',
    '/js/state.js',
    '/js/engine.js',
    '/js/ui.js',
    '/js/main.js',
    '/js/screens/resumen.js',
    '/js/screens/estructura.js',
    '/js/screens/versiones.js',
    '/js/screens/plan.js',
    '/js/screens/iop.js',
    '/js/screens/adecuaciones.js'
];

// Instalación: guarda todos los archivos en caché
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ARCHIVOS))
    );
    self.skipWaiting();
});

// Activación: borra cachés viejos
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: responde desde caché, si no va a la red
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});