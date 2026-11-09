// ══════════════════════════════════════════════════════════════════════════
// SERVICE WORKER — Factures SEN-CSU PWA
// Permet de rouvrir l'application SANS connexion internet.
// C'est ce fichier qui rend le vrai offline possible (impossible avec Apps Script).
// ══════════════════════════════════════════════════════════════════════════

// Changer la version a chaque mise a jour pour forcer le rafraichissement du cache
const CACHE_VERSION = "sencsu-v116";

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
// Strategie :
//   • API Apps Script : toujours le reseau (donnees fraiches).
//   • Page (index.html / navigation) : RESEAU D'ABORD, cache en secours hors ligne.
//     -> on ne sert plus jamais un ancien index.html fige : la derniere version en
//        ligne est toujours chargee des qu'il y a du reseau.
//   • Autres fichiers statiques (icones, manifest) : cache d'abord (rapide, offline).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = req.url;

  // Appels vers Apps Script : laisser passer au reseau (file d'attente locale si hors ligne).
  if (url.indexOf("script.google.com") !== -1 ||
      url.indexOf("googleusercontent.com") !== -1) {
    return;
  }
  if (req.method !== "GET") return;

  // Page principale / navigations : RESEAU D'ABORD.
  const estPage = req.mode === "navigate" ||
                  url.endsWith("/") ||
                  url.indexOf("index.html") !== -1;
  if (estPage) {
    event.respondWith(
      fetch(req).then((rep) => {
        if (rep && rep.status === 200) {
          const clone = rep.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return rep;
      }).catch(() =>
        caches.match(req).then((r) => r || caches.match("./index.html"))
      )
    );
    return;
  }

  // Autres fichiers de l'app : cache d'abord, reseau en secours.
  event.respondWith(
    caches.match(req).then((reponseCache) => {
      if (reponseCache) return reponseCache;
      return fetch(req).then((reponseReseau) => {
        if (reponseReseau && reponseReseau.status === 200) {
          const clone = reponseReseau.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return reponseReseau;
      }).catch(() => undefined);
    })
  );
});
