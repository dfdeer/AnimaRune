// 아니마룬 — 오프라인 실행용 서비스 워커
// 파일을 새 버전으로 올릴 때 아래 CACHE 이름의 숫자를 올리면 예전 캐시가 정리돼요.
const CACHE = 'animarune-v192';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// 네트워크 우선(온라인이면 항상 최신), 실패하면 캐시
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res=>{
      if(res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); }
      return res;
    }).catch(()=> caches.match(req).then(r=> r || caches.match('./index.html')))
  );
});
