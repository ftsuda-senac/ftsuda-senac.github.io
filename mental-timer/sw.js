/**
 * Mental Timer — Service Worker
 * Estratégia: Cache-First para assets locais, Network-First para CDN.
 * Permite uso offline completo após o primeiro carregamento.
 */

const CACHE_NAME  = 'mental-timer-v1';
const APP_SHELL   = [
  './mental-timer.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* Prefixos de CDN que queremos cachear oportunisticamente */
const CDN_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdn.jsdelivr.net',
];

// ── Install: pré-cache do app shell ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Assets locais — obrigatórios
      await cache.addAll(APP_SHELL);

      // Fontes externas — opcionais (não falha o install se offline)
      const cdnUrls = [
        'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap',
        'https://cdn.jsdelivr.net/npm/dseg@0.46.0/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2',
        'https://cdn.jsdelivr.net/npm/dseg@0.46.0/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff',
      ];
      await Promise.allSettled(cdnUrls.map(url => cache.add(url)));
    })
  );
  // Ativa imediatamente sem esperar o cliente anterior fechar
  self.skipWaiting();
});

// ── Activate: limpa caches de versões antigas ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Assume controle imediato de todas as abas abertas
  self.clients.claim();
});

// ── Fetch: Cache-First para locais / CDN; Network-First para resto ─────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests que não são GET
  if (request.method !== 'GET') return;

  // Ignora requests para outros protocolos (ex: chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  const isCdn   = CDN_ORIGINS.some(o => url.origin === o);
  const isLocal = url.origin === self.location.origin;

  if (isLocal || isCdn) {
    // Cache-First: serve do cache; se não tiver, busca na rede e armazena
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (response.ok || response.type === 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // Fallback offline: devolve o HTML principal para navegação
          if (request.destination === 'document') {
            return caches.match('./mental-timer.html');
          }
        });
      })
    );
  }
  // Requests para outras origens: deixa passar normalmente
});
