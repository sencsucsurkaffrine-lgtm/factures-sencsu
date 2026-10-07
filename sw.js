// ══════════════════════════════════════════════════════════════════════════
// SERVICE WORKER — Factures SEN-CSU PWA
// Permet de rouvrir l'application SANS connexion internet.
// C'est ce fichier qui rend le vrai offline possible (impossible avec Apps Script).
// ══════════════════════════════════════════════════════════════════════════

// Changer la version a chaque mise a jour pour forcer le rafraichissement du cache
const CACHE_VERSION = "sencsu-v33";

// Fichiers a mettre en cache pour un fonctionnement 100% hors ligne
const FICHIERS_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// ── INSTALLATION : mettre les fichiers en cache ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(FICHIERS_CACHE))
  );
  self.skipWaiting();  // activer immediatement la nouvelle version
});

// ── ACTIVATION : supprimer les anciens caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cles) =>
      Promise.all(
        cles.filter((c) => c !== CACHE_VERSION).map((c) => caches.delete(c))
      )
    )
  );
  self.clients.claim();
});

// ── INTERCEPTION DES REQUETES ──
// Strategie : "cache d'abord" pour les fichiers de l'app (marche offline),
// "reseau d'abord" pour les appels a l'API Apps Script (donnees fraiches).
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Les appels vers Apps Script (script.google.com) : toujours par le reseau.
  // S'ils echouent (hors ligne), l'app gere la mise en file d'attente locale.
  if (url.indexOf("script.google.com") !== -1 ||
      url.indexOf("googleusercontent.com") !== -1) {
    return; // laisser passer au reseau normalement
  }

  // Fichiers de l'app : cache d'abord, reseau en secours
  event.respondWith(
    caches.match(event.request).then((reponseCache) => {
      if (reponseCache) return reponseCache;
      return fetch(event.request).then((reponseReseau) => {
        // Mettre en cache les nouvelles ressources de l'app
        if (reponseReseau && reponseReseau.status === 200 &&
            event.request.method === "GET") {
          const clone = reponseReseau.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return reponseReseau;
      }).catch(() => {
        // Hors ligne et pas en cache : renvoyer la page principale si c'est une navigation
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
